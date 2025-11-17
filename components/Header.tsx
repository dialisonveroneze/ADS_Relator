import React from 'react';

interface HeaderProps {
    isAuthenticated: boolean;
    onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ isAuthenticated, onLogout }) => {
    return (
        <header className="bg-white dark:bg-gray-800 shadow-md p-4">
            <div className="container mx-auto flex items-center justify-between">
                <div className="flex items-center">
                    <svg className="w-8 h-8 text-blue-600 dark:text-blue-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <h1 className="text-xl font-bold text-gray-800 dark:text-white">
                        Meta Ads Dashboard
                    </h1>
                </div>
                {isAuthenticated && (
                    <button
                        onClick={onLogout}
                        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                    >
                        Sair
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;
