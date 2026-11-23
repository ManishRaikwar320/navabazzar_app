import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import socket
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from db import (
    add_user_address,
    advance_order_stage,
    authenticate_user,
    create_order,
    delete_user_address,
    get_orders_for_user,
    get_product_by_id_or_slug,
    get_tracking_by_number,
    get_user_profile,
    init_db,
    query_products,
    register_user,
    toggle_wishlist,
)

SESSION_SECRET = os.environ.get("SESSION_SECRET") or secrets.token_hex(32)
SESSION_COOKIE_NAME = "nb_session"
TOKEN_TTL_SEC = 7 * 24 * 60 * 60

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PHONE_RE = re.compile(r"^[0-9+\-\s]{8,15}$")
PIN_RE = re.compile(r"^\d{6}$")


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(val: str) -> bytes:
    pad = "=" * ((4 - len(val) % 4) % 4)
    return base64.urlsafe_b64decode(val + pad)


def sign_token(uid: str, email: str) -> str:
    payload_obj = {
        "uid": uid,
        "email": email,
        "exp": int((time.time() + TOKEN_TTL_SEC) * 1000),
    }
    payload = _b64url_encode(json.dumps(payload_obj, separators=(",", ":")).encode("utf-8"))
    sig = hmac.new(SESSION_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).digest()
    return f"{payload}.{_b64url_encode(sig)}"


def verify_token(token: str) -> Optional[Dict[str, str]]:
    parts = token.split(".")
    if len(parts) != 2:
        return None
    payload, sig = parts
    if not payload or not sig:
        return None
    expected_sig = _b64url_encode(
        hmac.new(SESSION_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).digest()
    )
    if not hmac.compare_digest(sig, expected_sig):
        return None
    try:
        parsed = json.loads(_b64url_decode(payload).decode("utf-8"))
        uid = parsed.get("uid")
        email = parsed.get("email")
        exp = parsed.get("exp")
        if not uid or not email or not isinstance(exp, (int, float)):
            return None
        if time.time() * 1000 > exp:
            return None
        return {"uid": str(uid), "email": str(email)}
    except Exception:
        return None


def clean_str(value: Any, max_len: int) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()[:max_len]


def _is_https(request: Request) -> bool:
    proto = (request.headers.get("x-forwarded-proto") or "").lower()
    return proto == "https"


def _set_session_cookie(request: Request, response: Response, value: str, max_age: int) -> None:
    parts = [
        f"{SESSION_COOKIE_NAME}={value}",
        "Path=/",
        "HttpOnly",
        f"Max-Age={max_age}",
    ]
    if _is_https(request):
        parts.extend(["SameSite=None", "Secure", "Partitioned"])
    else:
        parts.append("SameSite=Lax")
    response.headers.append("Set-Cookie", "; ".join(parts))


async def verify_csrf(request: Request) -> None:
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    if request.headers.get("x-requested-with") == "XMLHttpRequest":
        return
    origin = request.headers.get("origin")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    if origin and host:
        try:
            if urlparse(origin).netloc == host:
                return
        except Exception:
            pass
    raise HTTPException(status_code=403, detail="Invalid request origin or missing security header.")


async def get_optional_user(request: Request) -> Optional[Dict[str, Any]]:
    token: Optional[str] = None
    auth_header = request.headers.get("authorization") or ""
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    if not token:
        token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return None
    verified = verify_token(token)
    if not verified:
        return None
    return get_user_profile(verified["uid"])


async def require_user(user: Optional[Dict[str, Any]] = Depends(get_optional_user)) -> Dict[str, Any]:
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    return user


# Pydantic Request Models
class RegisterRequest(BaseModel):
    name: str
    email: str
    phone: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AddressRequest(BaseModel):
    id: Optional[str] = None
    label: Optional[str] = "Home"
    fullName: str
    phone: str
    street: str
    city: str
    state: str
    pinCode: str


class WishlistToggleRequest(BaseModel):
    productId: str


class OrderItemInput(BaseModel):
    productId: str
    variant: Optional[str] = ""
    quantity: int = Field(..., ge=1, le=10)


class CreateOrderRequest(BaseModel):
    items: List[OrderItemInput]
    address: AddressRequest
    paymentMethod: str
    paymentSummary: Optional[str] = "Demo Checkout"
    promoCode: Optional[str] = ""


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="NavaBazaar FastAPI + SQLite Backend",
    version="1.0.0",
    lifespan=lifespan,
)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": str(exc.detail)})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = exc.errors()
    msg = errors[0].get("msg", "Invalid request input.") if errors else "Invalid request input."
    return JSONResponse(status_code=400, content={"error": msg})


@app.get("/api/health")
def health_check() -> Dict[str, Any]:
    return {"ok": True, "engine": "fastapi-sqlite"}


@app.get("/api/products")
def list_products(
    q: str = Query(default="", max_length=100),
    category: str = Query(default="", max_length=50),
    brand: str = Query(default="", max_length=200),
    minPrice: Optional[float] = Query(default=None),
    maxPrice: Optional[float] = Query(default=None),
    minRating: float = Query(default=0.0),
    inStock: Optional[str] = Query(default=None),
    sort: str = Query(default="featured", max_length=30),
) -> Dict[str, Any]:
    brands = [b.strip() for b in brand.split(",") if b.strip()] if brand else []
    products = query_products(
        q=clean_str(q, 100),
        category=clean_str(category, 50),
        brands=brands,
        min_price=int(minPrice) if minPrice is not None else None,
        max_price=int(maxPrice) if maxPrice is not None else None,
        min_rating=minRating,
        in_stock_only=(inStock == "true"),
        sort=clean_str(sort, 30) or "featured",
    )
    return {"products": products, "total": len(products)}


@app.get("/api/products/{identifier}")
def get_product(identifier: str) -> Dict[str, Any]:
    product = get_product_by_id_or_slug(identifier.strip())
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
    return {"product": product}


@app.post("/api/auth/register", status_code=201, dependencies=[Depends(verify_csrf)])
def register(payload: RegisterRequest, request: Request, response: Response) -> Dict[str, Any]:
    name = clean_str(payload.name, 80)
    email = clean_str(payload.email, 120).lower()
    phone = clean_str(payload.phone, 20)
    password = payload.password

    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Please enter your full name (at least 2 characters).")
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if not PHONE_RE.match(phone):
        raise HTTPException(status_code=400, detail="Please enter a valid phone number.")
    if len(password) < 6 or len(password) > 100:
        raise HTTPException(status_code=400, detail="Password must be between 6 and 100 characters.")

    user, reg_err = register_user(name, email, phone, password)
    if reg_err or not user:
        raise HTTPException(status_code=409, detail=reg_err or "Registration failed.")

    token = sign_token(user["id"], user["email"])
    _set_session_cookie(request, response, token, TOKEN_TTL_SEC)
    return {"user": user, "token": token}


@app.post("/api/auth/login", dependencies=[Depends(verify_csrf)])
def login(payload: LoginRequest, request: Request, response: Response) -> Dict[str, Any]:
    email = clean_str(payload.email, 120).lower()
    password = payload.password
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    user = authenticate_user(email, password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = sign_token(user["id"], user["email"])
    _set_session_cookie(request, response, token, TOKEN_TTL_SEC)
    return {"user": user, "token": token}


@app.post("/api/auth/logout", dependencies=[Depends(verify_csrf)])
def logout(request: Request, response: Response) -> Dict[str, bool]:
    _set_session_cookie(request, response, "", 0)
    return {"ok": True}


@app.get("/api/auth/me")
def me(user: Optional[Dict[str, Any]] = Depends(get_optional_user)) -> Dict[str, Any]:
    return {"user": user}


@app.post("/api/account/addresses", status_code=201, dependencies=[Depends(verify_csrf)])
def create_address(
    payload: AddressRequest,
    user: Dict[str, Any] = Depends(require_user),
) -> Dict[str, Any]:
    label = clean_str(payload.label or "Home", 30) or "Home"
    full_name = clean_str(payload.fullName, 80)
    phone = clean_str(payload.phone, 20)
    street = clean_str(payload.street, 180)
    city = clean_str(payload.city, 60)
    state = clean_str(payload.state, 60)
    pin_code = clean_str(payload.pinCode, 10)

    if len(full_name) < 2 or len(street) < 5 or len(city) < 2 or len(state) < 2:
        raise HTTPException(status_code=400, detail="Please complete all address fields.")
    if not PIN_RE.match(pin_code):
        raise HTTPException(status_code=400, detail="PIN code must be a 6-digit number.")
    if not PHONE_RE.match(phone):
        raise HTTPException(status_code=400, detail="Please provide a valid delivery phone number.")

    profile, addr = add_user_address(
        user["id"], label, full_name, phone, street, city, state, pin_code
    )
    return {"user": profile, "address": addr}


@app.delete("/api/account/addresses/{address_id}", dependencies=[Depends(verify_csrf)])
def remove_address(
    address_id: str,
    user: Dict[str, Any] = Depends(require_user),
) -> Dict[str, Any]:
    profile = delete_user_address(user["id"], clean_str(address_id, 60))
    return {"user": profile}


@app.post("/api/account/wishlist/toggle", dependencies=[Depends(verify_csrf)])
def toggle_wishlist_route(
    payload: WishlistToggleRequest,
    user: Dict[str, Any] = Depends(require_user),
) -> Dict[str, Any]:
    product_id = clean_str(payload.productId, 60)
    profile, wish_err = toggle_wishlist(user["id"], product_id)
    if wish_err or not profile:
        raise HTTPException(status_code=400, detail=wish_err or "Invalid product.")
    return {"user": profile}


@app.get("/api/orders")
def list_orders(user: Dict[str, Any] = Depends(require_user)) -> Dict[str, Any]:
    orders = get_orders_for_user(user["id"])
    return {"orders": orders}


@app.post("/api/orders", status_code=201, dependencies=[Depends(verify_csrf)])
def submit_order(
    payload: CreateOrderRequest,
    user: Dict[str, Any] = Depends(require_user),
) -> Dict[str, Any]:
    if len(payload.items) == 0 or len(payload.items) > 25:
        raise HTTPException(status_code=400, detail="Cart must contain between 1 and 25 line items.")

    payment_method = clean_str(payload.paymentMethod, 20)
    if payment_method not in ("upi", "card", "netbanking", "cod"):
        raise HTTPException(status_code=400, detail="Invalid payment method selected.")

    payment_summary = clean_str(payload.paymentSummary or "Demo Checkout", 80) or "Demo Checkout"
    promo_code = clean_str(payload.promoCode or "", 20)

    full_name = clean_str(payload.address.fullName, 80)
    phone = clean_str(payload.address.phone, 20)
    street = clean_str(payload.address.street, 180)
    city = clean_str(payload.address.city, 60)
    state = clean_str(payload.address.state, 60)
    pin_code = clean_str(payload.address.pinCode, 10)
    label = clean_str(payload.address.label or "Home", 30) or "Home"

    if (
        len(full_name) < 2
        or len(street) < 5
        or len(city) < 2
        or len(state) < 2
        or not PIN_RE.match(pin_code)
    ):
        raise HTTPException(
            status_code=400,
            detail="Please provide a valid shipping address with a 6-digit PIN code.",
        )
    if not PHONE_RE.match(phone):
        raise HTTPException(status_code=400, detail="Please provide a valid contact phone number.")

    raw_items = [
        {
            "productId": clean_str(item.productId, 60),
            "variant": clean_str(item.variant or "", 60),
            "quantity": item.quantity,
        }
        for item in payload.items
    ]

    order, ord_err = create_order(
        user["id"],
        raw_items,
        {
            "id": clean_str(payload.address.id or "", 40),
            "label": label,
            "fullName": full_name,
            "phone": phone,
            "street": street,
            "city": city,
            "state": state,
            "pinCode": pin_code,
        },
        payment_method,
        payment_summary,
        promo_code,
    )
    if ord_err or not order:
        raise HTTPException(status_code=400, detail=ord_err or "Could not place order.")
    return {"order": order}


@app.get("/api/orders/track/{tracking_number}")
def track_order(
    tracking_number: str,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user),
) -> Dict[str, Any]:
    trk = clean_str(tracking_number, 40).upper()
    if not trk:
        raise HTTPException(status_code=400, detail="Tracking number is required.")
    tracking = get_tracking_by_number(trk, user["id"] if user else None)
    if not tracking:
        raise HTTPException(status_code=404, detail=f'No shipment found with tracking ID "{trk}".')
    return {"tracking": tracking}


@app.post("/api/orders/{order_id}/advance-tracking", dependencies=[Depends(verify_csrf)])
def advance_tracking_route(
    order_id: str,
    user: Dict[str, Any] = Depends(require_user),
) -> Dict[str, Any]:
    order, status_code, adv_err = advance_order_stage(clean_str(order_id, 60), user["id"])
    if adv_err:
        raise HTTPException(status_code=status_code, detail=adv_err)
    return {"order": order}


def main() -> None:
    port = int(os.environ.get("PY_API_PORT", "0"))
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("127.0.0.1", port))
    sock.listen(128)
    actual_port = sock.getsockname()[1]

    config = uvicorn.Config(app, host="127.0.0.1", port=actual_port, log_level="warning")
    server = uvicorn.Server(config)

    # Emit readiness marker only after DB is initialized and socket is bound
    init_db()
    print(f"PY_DB_READY:{actual_port}", flush=True)
    try:
        server.run(sockets=[sock])
    finally:
        sock.close()


if __name__ == "__main__":
    main()
