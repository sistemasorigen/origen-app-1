import React from 'react';

const TEAM_TO_CODE: Record<string, string> = {
    // CONMEBOL
    'argentina': 'ar', 'brasil': 'br', 'brazil': 'br', 'uruguay': 'uy',
    'colombia': 'co', 'chile': 'cl', 'peru': 'pe', 'perú': 'pe',
    'ecuador': 'ec', 'paraguay': 'py', 'venezuela': 've', 'bolivia': 'bo',
    // UEFA
    'francia': 'fr', 'france': 'fr',
    'inglaterra': 'gb-eng', 'england': 'gb-eng',
    'españa': 'es', 'espana': 'es', 'spain': 'es',
    'alemania': 'de', 'germany': 'de',
    'portugal': 'pt',
    'italia': 'it', 'italy': 'it',
    'paises bajos': 'nl', 'países bajos': 'nl', 'holanda': 'nl', 'netherlands': 'nl',
    'croacia': 'hr', 'croatia': 'hr',
    'belgica': 'be', 'bélgica': 'be', 'belgium': 'be',
    'dinamarca': 'dk', 'denmark': 'dk',
    'suiza': 'ch', 'switzerland': 'ch',
    'serbia': 'rs',
    'polonia': 'pl', 'poland': 'pl',
    'gales': 'gb-wls', 'wales': 'gb-wls',
    'escocia': 'gb-sct', 'scotland': 'gb-sct',
    'suecia': 'se', 'sweden': 'se',
    'ucrania': 'ua', 'ukraine': 'ua',
    'bosnia y herzegovina': 'ba', 'bosnia': 'ba',
    'eslovenia': 'si', 'slovenia': 'si',
    // Otros
    'turquia': 'tr', 'turquía': 'tr', 'turkey': 'tr',
    'curazao': 'cw', 'curacao': 'cw',
    'haiti': 'ht', 'haití': 'ht',
    'costa de marfil': 'ci', 'ivory coast': 'ci',
    'austria': 'at',
    'noruega': 'no', 'norway': 'no',
    'panama': 'pa', 'panamá': 'pa',
    // AFC
    'japon': 'jp', 'japón': 'jp', 'japan': 'jp',
    'irak': 'iq', 'iraq': 'iq',
    'jordania': 'jo', 'jordan': 'jo',
    'uzbekistan': 'uz', 'uzbekistán': 'uz',
    'corea del sur': 'kr', 'republica de corea': 'kr', 'south korea': 'kr', 'korea': 'kr',
    'chequia': 'cz', 'republica checa': 'cz', 'czech republic': 'cz', 'czechia': 'cz',
    'arabia saudita': 'sa', 'saudi arabia': 'sa',
    'iran': 'ir', 'irán': 'ir',
    'australia': 'au',
    'qatar': 'qa', 'katar': 'qa', 'cátar': 'qa', 'catar': 'qa',
    // CAF
    'senegal': 'sn',
    'marruecos': 'ma', 'morocco': 'ma',
    'tunez': 'tn', 'túnez': 'tn', 'tunisia': 'tn',
    'ghana': 'gh',
    'camerun': 'cm', 'camerún': 'cm', 'cameroon': 'cm',
    'egipto': 'eg', 'egypt': 'eg',
    'nigeria': 'ng',
    'sudafrica': 'za', 'sudáfrica': 'za', 'south africa': 'za',
    'angola': 'ao', 'mali': 'ml', 'zambia': 'zm',
    'argelia': 'dz', 'algeria': 'dz',
    'cabo verde': 'cv', 'cape verde': 'cv',
    'rd congo': 'cd', 'congo dr': 'cd', 'rdc': 'cd',
    // CONCACAF
    'mexico': 'mx', 'méxico': 'mx',
    'estados unidos': 'us', 'usa': 'us', 'united states': 'us',
    'costa rica': 'cr',
    'canada': 'ca', 'canadá': 'ca',
    // OFC
    'nueva zelanda': 'nz', 'new zealand': 'nz'
};

const normalizeName = (name: string): string =>
    name.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .trim();

export interface FlagImageProps {
    teamName: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    emoji?: string;
}

const FLAG_FONT_SIZE: Record<string, string> = { sm: '1rem', md: '1.5rem', lg: '2rem', xl: '2.75rem' };

const FlagImage: React.FC<FlagImageProps> = ({ teamName, size = 'lg', className = '', emoji }) => {
    const code = TEAM_TO_CODE[normalizeName(teamName)];
    if (!code) {
        if (emoji) return <span className={`leading-none drop-shadow-sm ${className}`} style={{ fontSize: FLAG_FONT_SIZE[size] }}>{emoji}</span>;
        return <span className={`text-slate-300 font-bold uppercase ${className}`}>{teamName.substring(0, 2)}</span>;
    }
    const sizeMap = { sm: 24, md: 32, lg: 48, xl: 64 };
    const px = sizeMap[size];
    return (
        <img
            src={`https://flagcdn.com/${code}.svg`}
            alt={`Bandera de ${teamName}`}
            width={px}
            className={`rounded-[4px] shadow-sm object-cover ${className}`}
            style={{ height: size === 'xl' ? '42px' : size === 'lg' ? '32px' : size === 'md' ? '22px' : '16px' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
    );
};

export default FlagImage;
