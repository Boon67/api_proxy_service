import React from 'react';
import { render, screen } from '@testing-library/react';
import StatsCard from '../StatsCard';

describe('StatsCard', () => {
  const defaultProps = {
    title: 'Test Title',
    value: 100,
    icon: () => <div data-testid="icon">Icon</div>,
    color: 'blue'
  };

  it('renders with basic props', () => {
    render(<StatsCard {...defaultProps} />);
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('formats numbers with locale string', () => {
    render(<StatsCard {...defaultProps} value={1000} />);
    
    expect(screen.getByText('1,000')).toBeInTheDocument();
  });

  it('renders change indicator when provided', () => {
    render(
      <StatsCard 
        {...defaultProps} 
        change={5} 
        changeLabel="from last month" 
      />
    );
    
    expect(screen.getByText('5%')).toBeInTheDocument();
    expect(screen.getByText('from last month')).toBeInTheDocument();
  });

  it('shows positive change with green color', () => {
    render(
      <StatsCard 
        {...defaultProps} 
        change={5} 
        changeLabel="increase" 
      />
    );
    
    const changeElement = screen.getByText('5%');
    expect(changeElement).toHaveClass('text-green-600');
  });

  it('shows negative change with red color', () => {
    render(
      <StatsCard 
        {...defaultProps} 
        change={-3} 
        changeLabel="decrease" 
      />
    );
    
    const changeElement = screen.getByText('3%');
    expect(changeElement).toHaveClass('text-red-600');
  });

  it('applies correct color classes', () => {
    const { rerender } = render(<StatsCard {...defaultProps} color="green" />);
    
    let iconElement = screen.getByTestId('icon');
    expect(iconElement).toHaveClass('text-green-500');

    rerender(<StatsCard {...defaultProps} color="red" />);
    iconElement = screen.getByTestId('icon');
    expect(iconElement).toHaveClass('text-red-500');
  });

  it('handles zero change', () => {
    render(
      <StatsCard 
        {...defaultProps} 
        change={0} 
        changeLabel="no change" 
      />
    );
    
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('no change')).toBeInTheDocument();
  });

  it('renders without change indicator when not provided', () => {
    render(<StatsCard {...defaultProps} />);
    
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('handles string values', () => {
    render(<StatsCard {...defaultProps} value="Active" />);
    
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('handles undefined change gracefully', () => {
    render(
      <StatsCard 
        {...defaultProps} 
        change={undefined} 
        changeLabel="test" 
      />
    );
    
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
