
import React, { useState } from 'react';

interface Platform {
    id: string;
    name: string;
    icon: React.ReactNode;
}

// Logos simplificados para as plataformas
const WooLogo = () => (
    <svg viewBox="0 0 100 100" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#96588A"/>
        <path d="M30 40C30 40 40 60 50 60C60 60 70 40 70 40" stroke="white" strokeWidth="5" strokeLinecap="round"/>
        <text x="50" y="80" fontSize="30" fill="white" textAnchor="middle" fontWeight="bold" fontFamily="sans-serif">W</text>
    </svg>
);

const ShopifyLogo = () => (
    <svg viewBox="0 0 100 100" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 30L30 80H70L80 30" fill="#95BF47"/>
        <path d="M50 10L35 30H65L50 10Z" fill="#5E8E3E"/>
        <path d="M45 45C45 45 50 55 55 45" stroke="white" strokeWidth="3"/>
    </svg>
);

const NuvemLogo = () => (
    <svg viewBox="0 0 100 100" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M25 60C25 60 20 50 30 40C30 40 40 20 60 30C60 30 80 30 80 50C80 50 90 70 70 70H30C30 70 20 70 25 60Z" fill="#2D3E50" stroke="#2D3E50" strokeWidth="2"/>
        <circle cx="70" cy="50" r="5" fill="white"/>
    </svg>
);

const VtexLogo = () => (
    <svg viewBox="0 0 100 100" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 20L50 80L80 20" stroke="#F71963" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const AdobeLogo = () => (
    <svg viewBox="0 0 100 100" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="#EB1000"/>
        <path d="M20 80L40 20H60L80 80H65L50 40L35 80H20Z" fill="white"/>
    </svg>
);

const PrestaLogo = () => (
    <svg viewBox="0 0 100 100" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="45" fill="#2C3E50"/>
        <path d="M35 60C35 60 40 70 50 70C60 70 65 60 65 60" stroke="#F1C40F" strokeWidth="5" strokeLinecap="round"/>
        <circle cx="40" cy="40" r="5" fill="white"/>
        <circle cx="60" cy="40" r="5" fill="white"/>
    </svg>
);

const WixLogo = () => (
    <svg viewBox="0 0 100 100" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="50" y="65" fontSize="40" fill="#000" textAnchor="middle" fontWeight="bold" fontFamily="sans-serif">WiX</text>
    </svg>
);

const LojaIntegradaLogo = () => (
    <svg viewBox="0 0 100 100" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="20" fill="#23C5B3"/>
        <path d="M30 30V60C30 70 40 70 50 70C60 70 70 70 70 60V30" stroke="white" strokeWidth="8" strokeLinecap="round"/>
        <circle cx="50" cy="40" r="5" fill="white"/>
    </svg>
);

const LinxLogo = () => (
    <svg viewBox="0 0 100 100" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 80L80 20" stroke="#FF6600" strokeWidth="12" strokeLinecap="round"/>
        <path d="M50 50L80 80" stroke="#FF6600" strokeWidth="12" strokeLinecap="round"/>
    </svg>
);

const SalesforceLogo = () => (
    <svg viewBox="0 0 100 100" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 60C20 60 20 40 40 30C40 30 60 20 80 40C80 40 90 60 70 70H30C30 70 20 70 20 60Z" fill="#00A1E0"/>
        <text x="50" y="55" fontSize="12" fill="white" textAnchor="middle" fontFamily="sans-serif">salesforce</text>
    </svg>
);

const IsetLogo = () => (
    <svg viewBox="0 0 100 100" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="45" fill="#0047BB"/>
        <rect x="45" y="35" width="10" height="40" fill="white"/>
        <circle cx="50" cy="25" r="6" fill="white"/>
    </svg>
);

const YampiLogo = () => (
    <svg viewBox="0 0 100 100" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 20C30 20 20 40 20 50C20 70 50 90 50 90C50 90 80 70 80 50C80 40 70 20 50 20Z" fill="#FF0066"/>
    </svg>
);

interface IntegrationSelectorProps {
    onBack: () => void;
    onContinue: (platform: string) => void;
}

const IntegrationSelector: React.FC<IntegrationSelectorProps> = ({ onBack, onContinue }) => {
    const [selected, setSelected] = useState<string | null>(null);
    const [custom, setCustom] = useState('');

    const platforms: Platform[] = [
        { id: 'woocommerce', name: 'WooCommerce', icon: <WooLogo /> },
        { id: 'shopify', name: 'Shopify', icon: <ShopifyLogo /> },
        { id: 'nuvemshop', name: 'Nuvemshop', icon: <NuvemLogo /> },
        { id: 'vtex', name: 'VTEX', icon: <VtexLogo /> },
        { id: 'adobe', name: 'Adobe Commerce', icon: <AdobeLogo /> },
        { id: 'prestashop', name: 'Prestashop', icon: <PrestaLogo /> },
        { id: 'wix', name: 'Wix', icon: <WixLogo /> },
        { id: 'lojaintegrada', name: 'Loja Integrada', icon: <LojaIntegradaLogo /> },
        { id: 'linx', name: 'Linx Commerce', icon: <LinxLogo /> },
        { id: 'salesforce', name: 'Salesforce', icon: <SalesforceLogo /> },
        { id: 'iset', name: 'iSET', icon: <IsetLogo /> },
        { id: 'yampi', name: 'Yampi', icon: <YampiLogo /> },
    ];

    const handleContinue = () => {
        const platform = selected || custom;
        if (platform) {
            onContinue(platform);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 md:p-8 max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                        Selecione a plataforma onde você vai fazer a integração
                    </h2>
                    <span className="text-xs md:text-sm font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full whitespace-nowrap ml-4">
                        3 de 4
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                    {platforms.map(p => (
                        <div 
                            key={p.id}
                            onClick={() => { setSelected(p.id); setCustom(''); }}
                            className={`
                                relative border rounded-xl p-6 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 h-40
                                ${selected === p.id 
                                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400 shadow-md' 
                                    : 'border-gray-200 hover:border-blue-400 hover:shadow-sm dark:border-gray-700 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
                                }
                            `}
                        >
                            <div className="w-12 h-12 flex items-center justify-center transform transition-transform group-hover:scale-110">
                                {p.icon}
                            </div>
                            <span className={`font-medium text-center ${selected === p.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-300'}`}>
                                {p.name}
                            </span>
                            
                            {selected === p.id && (
                                <div className="absolute top-3 right-3 w-3 h-3 bg-blue-600 rounded-full"></div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mb-10">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Outra plataforma
                    </label>
                    <input 
                        type="text" 
                        value={custom}
                        onChange={(e) => { setCustom(e.target.value); setSelected(null); }}
                        placeholder="Escreva o nome da plataforma"
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-shadow outline-none"
                    />
                </div>

                <div className="flex justify-end items-center gap-4 pt-6 border-t border-gray-100 dark:border-gray-700">
                    <button 
                        onClick={onBack}
                        className="text-blue-600 hover:text-blue-800 font-semibold px-4 py-2 rounded-lg transition-colors dark:text-blue-400 dark:hover:text-blue-300"
                    >
                        Voltar
                    </button>
                    <button 
                        onClick={handleContinue}
                        disabled={!selected && !custom}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transform active:scale-95"
                    >
                        Continuar
                    </button>
                </div>
            </div>
        </div>
    );
}

export default IntegrationSelector;
