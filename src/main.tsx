import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './ui/AppRoot'
import './ui/style.css'
import './ui/theme.css'
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
