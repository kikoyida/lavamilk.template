import { createApp } from 'vue'
import App from './App.vue'
import './assets/globals.css'
import reveal from './plugins/reveal'

createApp(App).use(reveal).mount('#app')
