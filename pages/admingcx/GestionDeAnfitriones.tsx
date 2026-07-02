import React, { useState, useEffect, useCallback } from 'react';
import { Group } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import HostsManagementPanel from '../../components/GCX/PanelGestionAnfitriones';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';
import { Loader2 } from 'lucide-react';

const GestionDeAnfitrionesContent: React.FC = () => {
    const { showToast } = useAdminGCXToast();
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchGroups = useCallback(async () => {
        const data = await supabaseService.getGroupsForAdmin();
        setGroups(data);
    }, []);

    useEffect(() => {
        setLoading(true);
        fetchGroups().finally(() => setLoading(false));
    }, [fetchGroups]);

    return loading ? (
        <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
        </div>
    ) : (
        <HostsManagementPanel
            groups={groups}
            onUpdate={fetchGroups}
            showToast={showToast}
        />
    );
};

const GestionDeAnfitriones: React.FC = () => (
    <AdminGCXLayout title="Gestión de Anfitriones">
        <GestionDeAnfitrionesContent />
    </AdminGCXLayout>
);

export default GestionDeAnfitriones;
