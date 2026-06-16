import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ResaleIQ from './ResaleIQ.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ResaleIQ />
  </StrictMode>,
)
