"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarOff,
  LayoutDashboard,
  Navigation,
  Package,
  Receipt,
  Repeat,
  Route,
  Store,
  Wheat,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"

const navigation = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Заказы", href: "/orders", icon: Package },
  { title: "Маршруты", href: "/routes", icon: Route },
  { title: "Водитель", href: "/driver", icon: Navigation },
  { title: "Исключения", href: "/exceptions", icon: CalendarOff },
  { title: "Абонементы", href: "/subscriptions", icon: Repeat },
  { title: "Счета", href: "/invoices", icon: Receipt },
  { title: "Продукты", href: "/products", icon: Wheat },
  { title: "Пекарня", href: "/bakery", icon: Store },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <img src="/brand/brotli-mark.png" alt="" className="size-8 shrink-0" />
          <div className="grid min-w-0 text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-medium">Delivery Manager</span>
            <span className="truncate text-xs text-muted-foreground">
              Доставки
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Меню</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive = pathname === item.href

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      tooltip={item.title}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setOpenMobile(false)}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
