import { createApp } from "vue";
import { createPinia } from "pinia";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/nunito";
import App from "./App.vue";
import { router } from "./router";
import "./assets/index.css";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
