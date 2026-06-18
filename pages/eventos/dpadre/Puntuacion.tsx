import React from 'react';
import { User } from '../../../types';
import ZonaOperativa from './ZonaOperativa';

interface Props {
    currentUser: User;
    zona: 'trivia' | 'futbol';
}

const titulos: Record<'trivia' | 'futbol', string> = {
    trivia: 'Buscador de familias',
    futbol: 'Fútbol Tenis',
};

const Puntuacion: React.FC<Props> = ({ currentUser, zona }) => (
    <ZonaOperativa zona={zona} titulo={titulos[zona]} currentUser={currentUser} />
);

export default Puntuacion;
