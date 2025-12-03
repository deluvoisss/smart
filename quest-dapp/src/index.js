import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { CosmosKitProvider } from '@cosmos-kit/react'
import { cosmoshubTestnet } from './config/chains'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CosmosKitProvider chains={[cosmoshubTestnet]}>
      <App />
    </CosmosKitProvider>
  </React.StrictMode>,
)
