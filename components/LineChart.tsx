
import React, { useEffect, useRef, useState } from 'react';
import { KpiData } from '../types';

// Since Chart.js is loaded from a CDN, we declare it as a global
declare const Chart: any;

interface LineChartProps {
    data: KpiData[];
    metric: keyof Pick<KpiData, 'amountSpent' | 'impressions'>;
    label: string;
    isLoading: boolean;
}

const LineChart: React.FC<LineChartProps> = ({ data, metric, label, isLoading }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<any>(null);
    const [isDarkMode, setIsDarkMode] = useState(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    useEffect(() => {
        if (!canvasRef.current || !data) return;

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        
        // Destroy previous chart instance if it exists
        if (chartRef.current) {
            chartRef.current.destroy();
        }

        if (isLoading || data.length === 0) {
            return; // Don't render chart if loading or no data
        }

        const labels = data.map(item => new Date(item.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }));
        const chartData = data.map(item => item[metric] as number);

        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const textColor = isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
        
        chartRef.current = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: chartData,
                    fill: true,
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    tension: 0.3,
                    pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(59, 130, 246, 1)',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: isDarkMode ? '#374151' : '#fff',
                        titleColor: isDarkMode ? '#fff' : '#333',
                        bodyColor: isDarkMode ? '#fff' : '#333',
                        borderColor: gridColor,
                        borderWidth: 1,
                    },
                },
                scales: {
                    x: {
                        grid: {
                            color: gridColor,
                        },
                        ticks: {
                            color: textColor,
                        }
                    },
                    y: {
                        grid: {
                            color: gridColor,
                        },
                         ticks: {
                            color: textColor,
                        }
                    }
                }
            }
        });

        // Cleanup function
        return () => {
            if(chartRef.current) {
                chartRef.current.destroy();
            }
        };
    }, [data, metric, label, isDarkMode, isLoading]);

    const renderOverlay = () => {
        if (isLoading) {
            return (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 rounded-lg">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            )
        }
        if (!isLoading && data.length === 0) {
            return (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 rounded-lg">
                    <p className="text-gray-500 dark:text-gray-400">Nenhum dado para exibir no gráfico.</p>
                </div>
            )
        }
        return null;
    }


    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg mt-6 relative" style={{ height: '400px' }}>
            <canvas ref={canvasRef}></canvas>
            {renderOverlay()}
        </div>
    );
};

export default LineChart;