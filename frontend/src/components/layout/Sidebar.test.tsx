import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Sidebar from './Sidebar';

describe('Sidebar Component', () => {
  it('should render the navigation links', () => {
    render(<Sidebar open={true} onClose={() => {}} />);
    
    expect(screen.getByText('Painel Geral')).toBeInTheDocument();
    expect(screen.getByText('Municípios')).toBeInTheDocument();
    expect(screen.getByText('Mapa')).toBeInTheDocument();
    expect(screen.getByText('Previsão IA')).toBeInTheDocument();
    expect(screen.getByText('Chat IA')).toBeInTheDocument();
  });

  it('should display the logo correctly', () => {
    render(<Sidebar open={true} onClose={() => {}} />);
    
    expect(screen.getByText('SUS')).toBeInTheDocument();
    expect(screen.getByText('Trânsito no SUS')).toBeInTheDocument();
  });

  it('should have the correct visibility based on open prop', () => {
    const { rerender } = render(<Sidebar open={false} onClose={() => {}} />);
    
    const aside = screen.getByRole('complementary');
    expect(aside).toHaveClass('-translate-x-full');

    rerender(<Sidebar open={true} onClose={() => {}} />);
    expect(aside).toHaveClass('translate-x-0');
  });
});
