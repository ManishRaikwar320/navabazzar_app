export type ProductCategory = 'Electronics' | 'Audio' | 'Fashion' | 'Home & Living';

export interface ProductReview {
  id: string;
  author: string;
  city: string;
  rating: number;
  title: string;
  comment: string;
  date: string;
  verified: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: ProductCategory;
  price: number;
  mrp: number;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  stockCount: number;
  image: string;
  tagline: string;
  description: string;
  variants: string[];
  highlights: string[];
  warranty: string;
  seller: string;
  deliveryDays: number;
  reviews: ProductReview[];
}

export interface CartItem {
  productId: string;
  variant: string;
  quantity: number;
}

export interface Address {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  addresses: Address[];
  wishlist: string[];
  createdAt: string;
}

export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'cod';

export type OrderStatus =
  | 'Order Confirmed'
  | 'Packed at Hub'
  | 'In Transit'
  | 'Out for Delivery'
  | 'Delivered';

export interface OrderMilestone {
  stage: OrderStatus;
  title: string;
  description: string;
  location: string;
  timestamp: string | null;
  completed: boolean;
}

export interface OrderItem {
  productId: string;
  name: string;
  brand: string;
  image: string;
  variant: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  trackingNumber: string;
  userId: string;
  customerName: string;
  shippingAddress: Address;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  promoCode: string | null;
  paymentMethod: PaymentMethod;
  paymentSummary: string;
  paymentStatus: 'Demo Paid' | 'Cash on Delivery';
  orderStatus: OrderStatus;
  courierName: string;
  estimatedDelivery: string;
  timeline: OrderMilestone[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicTrackingInfo {
  trackingNumber: string;
  orderStatus: OrderStatus;
  courierName: string;
  estimatedDelivery: string;
  destinationCity: string;
  itemCount: number;
  itemNames: string[];
  timeline: OrderMilestone[];
  createdAt: string;
  isOwner: boolean;
  order?: Order;
}

export type SortOption = 'featured' | 'price_asc' | 'price_desc' | 'rating_desc' | 'discount_desc';

export interface FilterState {
  search: string;
  category: 'All' | ProductCategory;
  brands: string[];
  minPrice: number | null;
  maxPrice: number | null;
  minRating: number;
  inStockOnly: boolean;
  sort: SortOption;
}
