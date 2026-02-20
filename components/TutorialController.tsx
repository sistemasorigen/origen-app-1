import React from 'react';
import ReactJoyride, { CallBackProps, STATUS, Step, TooltipRenderProps } from 'react-joyride';
import { tourStyles } from '../src/config/tours';

interface TutorialControllerProps {
    steps: Step[];
    run: boolean;
    onComplete: () => void;
    onSkip?: () => void;
    floaterProps?: any; // Allow passing specific floater props (like strategy: fixed)
    styles?: any;
}

const CustomTooltip = ({
    continuous,
    index,
    step,
    backProps,
    closeProps,
    primaryProps,
    tooltipProps,
    skipProps,
    size
}: TooltipRenderProps) => {
    return (
        <div
            {...tooltipProps}
            className="w-full max-w-sm bg-white border-[3px] border-black rounded-xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-left relative"
        >
            <div className="flex justify-between items-start mb-3">
                {step.title && <h3 className="text-lg font-black uppercase leading-tight mr-2">{step.title}</h3>}
                <span className="text-xs font-bold bg-neutral-100 px-2 py-1 rounded border border-neutral-200 whitespace-nowrap">
                    Paso {index + 1} de {size}
                </span>
            </div>

            <div className="text-sm font-medium text-neutral-600 mb-6 leading-relaxed">
                {step.content}
            </div>

            <div className="flex items-center justify-between mt-4">
                <button
                    {...skipProps}
                    className="text-xs font-bold uppercase text-neutral-400 hover:text-black transition-colors"
                >
                    Saltar
                </button>

                <div className="flex gap-2">
                    {index > 0 && (
                        <button
                            {...backProps}
                            className="text-xs font-bold uppercase text-black hover:bg-neutral-100 px-3 py-2 rounded transition-colors"
                        >
                            Anterior
                        </button>
                    )}
                    <button
                        {...primaryProps}
                        className="bg-black text-white text-xs font-black uppercase px-6 py-2 rounded-lg hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] transition-all"
                    >
                        {continuous ? 'Siguiente' : 'Finalizar'}
                    </button>
                </div>
            </div>

            {/* Close button (optional, but good for UX) */}
            <button
                {...closeProps}
                className="absolute -top-3 -right-3 bg-white border-2 border-black rounded-full p-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-none transition-all"
                aria-label="Cerrar"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
        </div>
    );
};

const TutorialController: React.FC<TutorialControllerProps> = ({ steps, run, onComplete, onSkip, styles, floaterProps }) => {
    const [isMobile, setIsMobile] = React.useState(false);

    React.useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status } = data;
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

        if (finishedStatuses.includes(status)) {
            onComplete();
        }
    };

    const responsiveStyles = {
        ...tourStyles,
        ...styles,
        options: {
            ...tourStyles.options,
            ...(styles?.options || {}),
            width: isMobile ? 300 : 400, // Responsive width
            zIndex: 10002, // Force high z-index
        }
    };

    // Add mobile-specific props AND merge with passed props
    const finalFloaterProps = {
        disableAnimation: true,
        offset: 15, // Push tooltip away from element
        ...(isMobile ? { shift: true, flip: true } : {}),
        ...floaterProps, // Merge external props (precedence to external)
    };

    return (
        <ReactJoyride
            steps={steps}
            run={run}
            continuous
            showProgress
            showSkipButton
            styles={responsiveStyles}
            callback={handleJoyrideCallback}
            floaterProps={finalFloaterProps}
            tooltipComponent={CustomTooltip}
            spotlightPadding={10} // Global padding for spotlight
            locale={{
                back: 'Anterior',
                close: 'Cerrar',
                last: 'Finalizar',
                next: 'Siguiente',
                skip: 'Saltar',
            }}
            scrollOffset={100} // Offset for scrolling to element
        />
    );
};

export default TutorialController;
