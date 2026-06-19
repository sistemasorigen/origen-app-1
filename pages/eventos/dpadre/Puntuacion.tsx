import React from 'react';
import { User } from '../../../types';
import ZonaOperativa from './ZonaOperativa';

interface Props {
    currentUser: User;
    zona: 'trivia' | 'futbol';
}

const Puntuacion: React.FC<Props> = ({ currentUser, zona }) => (
    <ZonaOperativa zona={zona} titulo="Buscador de padres" currentUser={currentUser} />
);

export default Puntuacion;
