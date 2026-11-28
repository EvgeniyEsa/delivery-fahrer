// Customer links stay on this host. A temporary tunnel address must not replace it.
const CUSTOMER_ORIGIN = "https://order.broetli.com"

export async function customerOrigin() {
  return CUSTOMER_ORIGIN
}
