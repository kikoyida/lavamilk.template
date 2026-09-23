import { createApp } from 'vue'
import App from './App.vue'
import './assets/globals.css'
import reveal from './plugins/reveal'
import { i18n } from './i18n'

createApp(App).use(i18n).use(reveal).mount('#app')
