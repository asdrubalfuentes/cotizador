import { render, screen } from '@testing-library/react'
import React from 'react'
import App from './App'

describe('App', () => {
  it('renders app title', () => {
    render(<App />)
    expect(screen.getByText(/Cotizador/i)).toBeInTheDocument()
  })
})
