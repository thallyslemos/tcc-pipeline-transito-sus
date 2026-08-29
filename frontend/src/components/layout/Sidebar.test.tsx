import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Sidebar from './Sidebar';

describe('Sidebar Component', () => {
  it('should render the navigation links', () => {
    render(<Sidebar open={true} onClose={() => {}} />);
    
    expect(screen.getByText('Visão geral')).toBeInTheDocument();
    expect(screen.getByText('Municípios')).toBeInTheDocument();
    expect(screen.getByText('Mapa')).toBeInTheDocument();
    expect(screen.getByText('Tendências')).toBeInTheDocument();
    expect(screen.getByText('Exploração em linguagem natural')).toBeInTheDocument();
  });

  it('agrupa a navegacao em Panorama/Territorio/Metodo, sem mudar nenhuma rota', () => {
    render(<Sidebar open={true} onClose={() => {}} />);

    expect(screen.getByText('Panorama')).toBeInTheDocument();
    expect(screen.getByText('Território')).toBeInTheDocument();
    expect(screen.getByText('Método')).toBeInTheDocument();

    // design/DESIGN_SYSTEM.md §10: "renomeie apenas os rotulos; mantenha os
    // caminhos de rota como estao" — cada link precisa continuar apontando
    // pro href original, so o texto visivel mudou.
    expect(screen.getByText('Visão geral').closest('a')).toHaveAttribute('href', '/dashboard');
    expect(screen.getByText('Qualidade e preliminares').closest('a')).toHaveAttribute('href', '/preliminares');
    expect(screen.getByText('Fluxos entre municípios').closest('a')).toHaveAttribute('href', '/fluxos');
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
