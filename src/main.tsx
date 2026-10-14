import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './ui/AppRoot'
import './ui/styles/index.css'
import {installRuntimeLogging} from './services/runtimeLog'
installRuntimeLogging()
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
