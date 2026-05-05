import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';

interface TourStep {
    title: string;
    description: string;
    targetSelector?: string; // CSS selector for spotlight (optional)
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface OnboardingTourProps {
    onComplete: () => void;
    userName?: string;
}

const TOUR_STEPS: TourStep[] = [
    {
        title: '¡Bienvenido a Origen!',
        description: 'Esta es tu plataforma de gestión integral para la iglesia. Te vamos a guiar por las principales funcionalidades.',
        position: 'center'
    },
    {
        title: 'Áreas de Servicio',
        description: 'Accedé a los diferentes módulos: Grupos de Conexión, Punto de Info, Reportes y más. Hacé clic en cualquier tarjeta para ingresar.',
        targetSelector: '#systems-grid',
        position: 'top'
    },
    {
        title: 'Cambiar Tema',
        description: 'Podés cambiar entre modo claro y oscuro usando el botón de sol/luna en la barra superior.',
        position: 'center'
    },
    {
        title: 'Tu Sesión',
        description: 'En la esquina superior derecha vas a ver tu rol actual y el botón para cerrar sesión.',
        position: 'center'
    },
    {
        title: '¡Listo para empezar!',
        description: 'Ya conocés lo básico. Explorá los módulos y descubrí todas las herramientas disponibles.',
        position: 'center'
    }
];

const OnboardingTour: React.FC<OnboardingTourProps> = ({ onComplete, userName }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [isVisible, setIsVisible] = useState(true);

    const step = TOUR_STEPS[currentStep];
    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === TOUR_STEPS.length - 1;

    const handleNext = () => {
        if (isLastStep) {
            handleComplete();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (!isFirstStep) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleSkip = () => {
        handleComplete();
    };

    const handleComplete = () => {
        setIsVisible(false);
        localStorage.setItem('onboarding_completed', 'true');
        onComplete();
    };

    if (!isVisible) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-title"
        >
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Tour Card */}
            <div className="relative w-full max-w-md mx-4 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
                {/* Progress Bar */}
                <div className="h-1 bg-slate-200 dark:bg-slate-700">
                    <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                        style={{ width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%` }}
                    />
                </div>

                {/* Header */}
                <div className="p-6 pb-4">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                    Paso {currentStep + 1} de {TOUR_STEPS.length}
                                </span>
                                <h2 id="tour-title" className="text-xl font-bold text-slate-900 dark:text-white">
                                    {step.title}
                                </h2>
                            </div>
                        </div>
                        <button
                            onClick={handleSkip}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                            aria-label="Saltar tour"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 pb-6">
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        {currentStep === 0 && userName ? `¡Hola ${userName}! ` : ''}
                        {step.description}
                    </p>
                </div>

                {/* Footer Actions */}
                <div className="px-6 pb-6 flex items-center justify-between gap-4">
                    <button
                        onClick={handleSkip}
                        className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                        Saltar tour
                    </button>

                    <div className="flex items-center gap-2">
                        {!isFirstStep && (
                            <button
                                onClick={handlePrev}
                                className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Anterior
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            className="flex items-center gap-1 px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25"
                        >
                            {isLastStep ? '¡Empezar!' : 'Siguiente'}
                            {!isLastStep && <ChevronRight className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Dots Indicator */}
                <div className="flex justify-center gap-2 pb-4">
                    {TOUR_STEPS.map((_, idx) => (
                        <div
                            key={idx}
                            className={`w-2 h-2 rounded-full transition-all ${idx === currentStep
                                ? 'bg-indigo-500 w-6'
                                : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default OnboardingTour;

// Hook to manage onboarding state
export const useOnboarding = () => {
    const [showOnboarding, setShowOnboarding] = useState(false);

    useEffect(() => {
        const completed = localStorage.getItem('onboarding_completed');
        if (!completed) {
            // Small delay to let the page render first
            const timer = setTimeout(() => {
                setShowOnboarding(true);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, []);

    const completeOnboarding = () => {
        setShowOnboarding(false);
    };

    const resetOnboarding = () => {
        localStorage.removeItem('onboarding_completed');
        setShowOnboarding(true);
    };

    return { showOnboarding, completeOnboarding, resetOnboarding };
};
