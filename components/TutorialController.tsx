import React from 'react';
import ReactJoyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { tourStyles } from '../src/config/tours';

interface TutorialControllerProps {
    steps: Step[];
    run: boolean;
    onComplete: () => void;
    onSkip?: () => void;
    styles?: any;
}

const TutorialController: React.FC<TutorialControllerProps> = ({ steps, run, onComplete, onSkip, styles }) => {
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

    // Add mobile-specific props
    const floaterProps = {
        disableAnimation: true,
        ...(isMobile ? { shift: true, flip: true } : {})
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
            floaterProps={floaterProps}
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
