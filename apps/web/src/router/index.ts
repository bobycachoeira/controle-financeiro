import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { loadTokens } from "@/api/tokens";
import { useSessionStore } from "@/stores/session";

const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "login",
    component: () => import("@/features/auth/LoginView.vue"),
    meta: { public: true },
  },
  {
    path: "/2fa",
    name: "2fa",
    component: () => import("@/features/auth/TwoFactorView.vue"),
    meta: { public: true },
  },
  {
    path: "/onboarding",
    name: "onboarding",
    component: () => import("@/features/household/HouseholdView.vue"),
    meta: { auth: true },
  },
  {
    path: "/pending",
    name: "pending",
    component: () => import("@/features/household/PendingApprovalView.vue"),
    meta: { auth: true },
  },
  {
    path: "/join",
    name: "join",
    component: () => import("@/features/household/JoinView.vue"),
    meta: { public: true },
  },
  {
    path: "/",
    component: () => import("@/components/AppLayout.vue"),
    meta: { auth: true, household: true },
    children: [
      { path: "", name: "dashboard", component: () => import("@/features/dashboard/DashboardView.vue") },
      {
        path: "transactions",
        name: "transactions",
        component: () => import("@/features/transactions/TransactionsView.vue"),
      },
      {
        path: "transactions/new",
        name: "transaction-new",
        component: () => import("@/features/transactions/NewTransactionView.vue"),
      },
      {
        path: "transactions/:id/edit",
        name: "transaction-edit",
        component: () => import("@/features/transactions/NewTransactionView.vue"),
      },
      { path: "wallet", name: "wallet", component: () => import("@/features/wallet/WalletView.vue") },
      { path: "accounts", name: "accounts", component: () => import("@/features/accounts/AccountsView.vue") },
      { path: "cards", name: "cards", component: () => import("@/features/cards/CardsView.vue") },
      {
        path: "invoices/:id",
        name: "invoice",
        component: () => import("@/features/cards/InvoiceView.vue"),
      },
      { path: "transfers", name: "transfers", component: () => import("@/features/transfers/TransferView.vue") },
      { path: "bills", name: "bills", component: () => import("@/features/bills/BillsView.vue") },
      {
        path: "recurrences",
        name: "recurrences",
        component: () => import("@/features/recurrences/RecurrencesView.vue"),
      },
      {
        path: "budgets",
        name: "budgets",
        component: () => import("@/features/budgets/BudgetsView.vue"),
      },
      {
        path: "settle",
        name: "settle",
        component: () => import("@/features/settle/SettleView.vue"),
      },
      {
        path: "goals",
        name: "goals",
        component: () => import("@/features/goals/GoalsView.vue"),
      },
      { path: "import", name: "import", component: () => import("@/features/import/ImportView.vue") },
      {
        path: "currencies",
        name: "currencies",
        component: () => import("@/features/settings/CurrenciesView.vue"),
      },
      {
        path: "integrations",
        name: "integrations",
        component: () => import("@/features/settings/IntegrationsView.vue"),
      },
      {
        path: "categories",
        name: "categories",
        component: () => import("@/features/categories/CategoriesView.vue"),
      },
      {
        path: "export",
        name: "export",
        component: () => import("@/features/settings/ExportView.vue"),
      },
      {
        path: "calendar",
        name: "calendar",
        component: () => import("@/features/calendar/CalendarView.vue"),
      },
      {
        path: "closing",
        name: "closing",
        component: () => import("@/features/closing/ClosingView.vue"),
      },
      {
        path: "investments",
        name: "investments",
        component: () => import("@/features/investments/InvestmentsView.vue"),
      },
      { path: "family", name: "family", component: () => import("@/features/household/FamilyView.vue") },
      { path: "people", name: "people", redirect: { name: "family" } },
      { path: "profile", name: "profile", component: () => import("@/features/settings/ProfileView.vue") },
      { path: "passkeys", name: "passkeys", component: () => import("@/features/settings/PasskeysView.vue") },
      { path: "invites", name: "invites", redirect: { name: "family" } },
      { path: "devices", name: "devices", component: () => import("@/features/auth/DevicesView.vue") },
      {
        path: "notifications",
        name: "notifications",
        component: () => import("@/features/settings/NotificationsView.vue"),
      },
      { path: "app-lock", name: "app-lock", component: () => import("@/features/settings/AppLockView.vue") },
      { path: "audit", name: "audit", component: () => import("@/features/settings/AuditView.vue") },
      { path: "more", name: "more", component: () => import("@/features/settings/MoreView.vue") },
    ],
  },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
  const session = useSessionStore();
  const hasToken = Boolean(loadTokens()?.token);

  if (to.meta.public) return true;
  if (!hasToken) return { name: "login" };

  if (!session.initialized && !session.stepUpRequired) {
    try {
      await session.loadMe();
    } catch {
      return { name: "login" };
    }
  }

  if (session.stepUpRequired && to.name !== "2fa") {
    return { name: "2fa" };
  }

  if (to.meta.household && !session.hasHousehold) {
    return { name: session.hasPending ? "pending" : "onboarding" };
  }

  if (to.name === "onboarding" && session.hasHousehold) {
    return { name: "dashboard" };
  }

  if (to.name === "pending" && session.hasHousehold) {
    return { name: "dashboard" };
  }

  if (to.name === "dashboard" && to.query.new === "1" && session.hasHousehold) {
    return { name: "transaction-new" };
  }

  return true;
});
