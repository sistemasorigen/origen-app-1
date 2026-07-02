import React from 'react';
import CoordinatorsManagementPanel from '../../components/GCX/PanelGestionCoordinadores';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';

const GestionDeCoordinadoresContent: React.FC = () => {
    const { showToast } = useAdminGCXToast();
    return <CoordinatorsManagementPanel showToast={showToast} />;
};

const GestionDeCoordinadores: React.FC = () => (
    <AdminGCXLayout title="Gestión de Coordinadores">
        <GestionDeCoordinadoresContent />
    </AdminGCXLayout>
);

export default GestionDeCoordinadores;
