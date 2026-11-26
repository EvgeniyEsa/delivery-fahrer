export type OrderStatus = "pending" | "in_transit" | "delivered"

export type Order = {
  id: string
  shopifyOrderId: string
  number: string
  customer: string
  phone: string
  address: string
  status: OrderStatus
  window: string
  deliveryDate: string | null
  deliveredAt?: string | null
  latitude?: number | null
  longitude?: number | null
  comment: string
}

export const mockOrders: Order[] = [
  {
    id: "1042",
    number: "#1042",
    customer: "Анна Ковалёва",
    phone: "",
    address: "ул. Тверская, 18, Москва",
    status: "in_transit",
    window: "10:00–12:00",
    shopifyOrderId: "",
    deliveryDate: "2026-11-24",
    comment: "Позвонить за 10 минут",
  },
  {
    id: "1043",
    number: "#1043",
    customer: "Илья Морозов",
    phone: "",
    address: "пр-т Мира, 42, Москва",
    status: "pending",
    window: "12:00–14:00",
    shopifyOrderId: "",
    deliveryDate: "2026-11-24",
    comment: "",
  },
  {
    id: "1044",
    number: "#1044",
    customer: "Мария Соколова",
    phone: "",
    address: "ул. Арбат, 7, Москва",
    status: "pending",
    window: "14:00–16:00",
    shopifyOrderId: "",
    deliveryDate: "2026-11-25",
    comment: "",
  },
  {
    id: "1045",
    number: "#1045",
    customer: "Павел Орлов",
    phone: "",
    address: "Ленинский пр-т, 90, Москва",
    status: "delivered",
    window: "09:00–11:00",
    shopifyOrderId: "",
    deliveryDate: "2026-11-23",
    comment: "",
  },
  {
    id: "1046",
    number: "#1046",
    customer: "Елена Виноградова",
    phone: "",
    address: "ул. Бауманская, 15, Москва",
    status: "in_transit",
    window: "16:00–18:00",
    shopifyOrderId: "",
    deliveryDate: "2026-11-25",
    comment: "Оставить у двери",
  },
]
