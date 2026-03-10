import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { ToastProvider } from './contexts/ToastContext'
import { DriveSyncProvider } from './contexts/DriveSyncContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
            <ToastProvider>
                <DriveSyncProvider>
                    <App />
                </DriveSyncProvider>
            </ToastProvider>
        </BrowserRouter>
    </React.StrictMode>,
)

