import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ResaleIQ from './ResaleIQ.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ResaleIQ />
  </StrictMode>,
)
