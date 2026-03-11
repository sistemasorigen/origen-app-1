import re

file_path = 'components/groups/HostsManagementPanel.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Chunk 1: State
content = content.replace(
    "const [allHosts, setAllHosts] = useState<{ user: User, role: 'HOST' | 'CO_HOST' }[]>([]);",
    "const [allHosts, setAllHosts] = useState<{ user: User, isHost: boolean, isCoHost: boolean }[]>([]);"
)

content = content.replace(
    "const [roleChangeModalOpen, setRoleChangeModalOpen] = useState(false);\n    const [roleChangeTarget, setRoleChangeTarget] = useState<{ user: User, currentRole: 'HOST' | 'CO_HOST' } | null>(null);",
    "const [manageRolesModalOpen, setManageRolesModalOpen] = useState(false);\n    const [manageRolesTarget, setManageRolesTarget] = useState<{ user: User, isHost: boolean, isCoHost: boolean } | null>(null);"
)

# Chunk 2: fetchRoleUsers combined
old_fetch = """            // Combine into unified list
            const combined = [
                ...hosts.map(u => ({ user: u, role: 'HOST' as const })),
                ...coHosts.map(u => ({ user: u, role: 'CO_HOST' as const }))
            ];

            // Deduplicate
            const unique = Array.from(new Map(combined.map(item => [item.user.id, item])).values());
            setAllHosts(unique);"""

new_fetch = """            // Combine into unified list tracking both roles
            const hostsMap = new Map<string, User>(hosts.map(u => [u.id, u]));
            const coHostsMap = new Map<string, User>(coHosts.map(u => [u.id, u]));
            
            const allUniqueIds = new Set([...hostsMap.keys(), ...coHostsMap.keys()]);
            const combined = Array.from(allUniqueIds).map(id => {
                const isHost = hostsMap.has(id);
                const isCoHost = coHostsMap.has(id);
                const user = (hostsMap.get(id) || coHostsMap.get(id))!;
                return { user, isHost, isCoHost };
            });
            setAllHosts(combined);"""
content = content.replace(old_fetch, new_fetch)

# Chunk 3 & 4: handleToggleManageRole replacing confirmRoleChange
old_confirm = """    const confirmRoleChange = async () => {
        if (!roleChangeTarget) return;
        const { user, currentRole } = roleChangeTarget;

        // Define roles
        const newRole = currentRole === 'HOST' ? UserRole.CO_ANFITRION : UserRole.ANFITRION;
        const oldRole = currentRole === 'HOST' ? UserRole.ANFITRION : UserRole.CO_ANFITRION;

        // Perform Update
        setIsLoading(true);
        try {
            // 1. Add New Role
            const addSuccess = await supabaseService.toggleUserRole(user.id, newRole, true);

            // 2. Remove Old Role (Only if add was successful to prevent data loss)
            if (addSuccess) {
                await supabaseService.toggleUserRole(user.id, oldRole, false);

                showToast(`Rol actualizado a ${newRole === UserRole.ANFITRION ? 'Anfitrión' : 'Co-Anfitrión'}`);
                onUpdate();
                fetchRoleUsers();
            } else {
                showToast('Error al asignar el nuevo rol', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Error inesperado', 'error');
        } finally {
            setIsLoading(false);
            setRoleChangeModalOpen(false);
            setRoleChangeTarget(null);
        }
    };"""

new_toggle = """    const handleToggleRoleFromModal = async (roleType: 'HOST' | 'CO_HOST', assign: boolean) => {
        if (!manageRolesTarget) return;
        setIsLoading(true);
        try {
            const targetRole = roleType === 'HOST' ? UserRole.ANFITRION : UserRole.CO_ANFITRION;
            const success = await supabaseService.toggleUserRole(manageRolesTarget.user.id, targetRole, assign);
            if (success) {
                setManageRolesTarget(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        isHost: roleType === 'HOST' ? assign : prev.isHost,
                        isCoHost: roleType === 'CO_HOST' ? assign : prev.isCoHost
                    };
                });
                
                // Cleanup groups if removed
                if (!assign) {
                    const group = groups.find(g =>
                        (roleType === 'HOST' && g.host_id === manageRolesTarget.user.id) ||
                        (roleType === 'CO_HOST' && g.co_host_id === manageRolesTarget.user.id)
                    );
                    if (group) {
                        const updatePayload = { ...group };
                        if (roleType === 'HOST') updatePayload.host_id = null;
                        else updatePayload.co_host_id = null;
                        await updateGroupDirect(updatePayload);
                    }
                }
                
                showToast(`Rol actualizado correctamente`);
                await fetchRoleUsers();
                onUpdate();
            } else {
                showToast('Error al modificar rol', 'error');
            }
        } finally {
            setIsLoading(false);
        }
    };"""
content = content.replace(old_confirm, new_toggle)

# Chunk 5: Filter Logic
old_filter = """        const matchRole = roleFilter === 'ALL' || item.role === roleFilter;

        const assignedGroup = groups.find(g =>
            (item.role === 'HOST' && g.host_id === item.user.id) ||
            (item.role === 'CO_HOST' && g.co_host_id === item.user.id)
        );"""

new_filter = """        const matchRole = roleFilter === 'ALL' || 
            (roleFilter === 'HOST' && item.isHost) || 
            (roleFilter === 'CO_HOST' && item.isCoHost);

        const assignedGroup = groups.find(g =>
            g.host_id === item.user.id || g.co_host_id === item.user.id
        );"""
content = content.replace(old_filter, new_filter)

# Chunk 6 & 7 mapping replacing (Regex to grab the big render block)
import re

render_mapping_pattern = r"filteredHosts\.map\(\(\{ user, role \}, index\) => \{.*?\n                                </div>\n                            \);\n                        \}\)"
# we will replace the big block:
# We find it using re.DOTALL

new_render_mapping = """filteredHosts.map((item, index) => {
                            const { user, isHost, isCoHost } = item;
                            const assignedGroup = groups.find(g => g.host_id === user.id || g.co_host_id === user.id);

                            // Kebab Menu State
                            const isMenuOpen = activeMenuId === user.id;
                            const isLastItem = index >= filteredHosts.length - 2;

                            return (
                                <div key={user.id} className="group transition-colors hover:bg-slate-50 relative">

                                    {/* --- MOBILE LAYOUT (Stack) --- */}
                                    <div className="md:hidden p-4 flex flex-col gap-3">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-12 h-12 rounded-full border border-black/10 flex items-center justify-center font-bold text-lg shrink-0 ${isHost ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-600'}`}>
                                                    {user.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-sm text-slate-900 leading-tight">{user.name}</h3>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        {(isHost || (!isHost && !isCoHost)) && (
                                                        <button onClick={(e) => { e.stopPropagation(); setManageRolesTarget({user, isHost, isCoHost}); setManageRolesModalOpen(true); }} className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 px-2 py-1 rounded-md transition-all ${isHost ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                                            Anfitrión <div className="bg-white/50 p-0.5 rounded-full"><Edit2 className="w-2.5 h-2.5" /></div>
                                                        </button>
                                                        )}
                                                        {isCoHost && (
                                                        <button onClick={(e) => { e.stopPropagation(); setManageRolesTarget({user, isHost, isCoHost}); setManageRolesModalOpen(true); }} className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1 px-2 py-1 rounded-md transition-all bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700">
                                                            Co-Anfitrión <div className="bg-white/50 p-0.5 rounded-full"><Edit2 className="w-2.5 h-2.5" /></div>
                                                        </button>
                                                        )}
                                                        <p className="text-[10px] text-slate-400 truncate max-w-[120px]">{user.email}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="relative">
                                                <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(isMenuOpen ? null : user.id); }} className="p-1 text-slate-400 hover:text-black transition-colors">
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>
                                                {isMenuOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setActiveMenuId(null)} />
                                                        <div className={`absolute right-0 ${isLastItem ? 'bottom-full mb-1 origin-bottom-right' : 'top-full mt-1 origin-top-right'} w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
                                                            <button onClick={() => { openAssignmentModal(user, isHost ? 'HOST' : 'CO_HOST'); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                                Editar Asignación
                                                            </button>
                                                            <button onClick={() => { setManageRolesTarget({user, isHost, isCoHost}); setManageRolesModalOpen(true); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100">
                                                                <Shield className="w-3.5 h-3.5" />
                                                                Administrar Roles
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="pl-[60px]">
                                            {assignedGroup ? (
                                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                                    <div className={`w-2 h-2 rounded-full ${assignedGroup.status === 'approved' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                                    <span className="font-medium truncate">{assignedGroup.name}</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span className="text-[10px] uppercase text-slate-400">{assignedGroup.meetingDay} {assignedGroup.meetingTime}</span>
                                                </div>
                                            ) : (
                                                <button onClick={() => openAssignmentModal(user, isHost ? 'HOST' : 'CO_HOST')} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                                                    <Plus className="w-3 h-3" />
                                                    Asignar a un Grupo
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* --- DESKTOP LAYOUT (Table Row) --- */}
                                    <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 items-center">
                                        <div className="col-span-3 flex items-center gap-3 overflow-hidden">
                                            <div className={`w-10 h-10 rounded-full border-2 border-black flex items-center justify-center font-bold text-sm shrink-0 ${isHost ? 'bg-black text-white' : 'bg-slate-200 text-black'}`}>
                                                {user.name.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm uppercase truncate">{user.name}</p>
                                                <p className="text-[10px] text-slate-500 font-mono truncate">{user.email}</p>
                                            </div>
                                        </div>

                                        <div className="col-span-2 flex flex-wrap justify-center gap-2">
                                            {(isHost || (!isHost && !isCoHost)) && (
                                            <button onClick={() => { setManageRolesTarget({user, isHost, isCoHost}); setManageRolesModalOpen(true); }} className={`group relative px-2 md:px-3 py-1 rounded-full text-[10px] font-black uppercase border-2 transition-all duration-200 active:scale-95 flex items-center gap-1 ${isHost ? 'bg-yellow-300 border-black text-black hover:bg-yellow-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' : 'bg-white border-slate-300 text-slate-500 hover:border-black hover:text-black hover:bg-slate-50'}`} title="Clic para administrar rol">
                                                <span>Anfitrión</span>
                                            </button>
                                            )}
                                            {isCoHost && (
                                            <button onClick={() => { setManageRolesTarget({user, isHost, isCoHost}); setManageRolesModalOpen(true); }} className={'group relative px-2 md:px-3 py-1 rounded-full text-[10px] font-black uppercase border-2 transition-all duration-200 active:scale-95 flex items-center gap-1 bg-white border-slate-300 text-slate-500 hover:border-black hover:text-black hover:bg-slate-50'} title="Clic para administrar rol">
                                                <span>Co-Anfitrión</span>
                                            </button>
                                            )}
                                        </div>

                                        <div className="col-span-4 pl-0">
                                            {assignedGroup ? (
                                                <div onClick={() => openAssignmentModal(user, isHost ? 'HOST' : 'CO_HOST')} className="group cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg border border-transparent hover:border-black/10 hover:bg-white transition-all w-full">
                                                    <div className={`w-2 h-2 rounded-full shrink-0 ${assignedGroup.status === 'approved' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold uppercase truncate">{assignedGroup.name}</p>
                                                        <p className="text-[9px] text-slate-500 uppercase">{assignedGroup.meetingDay} {assignedGroup.meetingTime}</p>
                                                    </div>
                                                    <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 ml-auto" />
                                                </div>
                                            ) : (
                                                <button onClick={() => openAssignmentModal(user, isHost ? 'HOST' : 'CO_HOST')} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-500 text-[10px] font-bold uppercase rounded-md hover:border-black hover:text-black hover:bg-white transition-all flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-red-400" />
                                                    Sin Asignar
                                                </button>
                                            )}
                                        </div>

                                        <div className="col-span-3 flex justify-end items-center gap-2">
                                            <button onClick={() => openAssignmentModal(user, isHost ? 'HOST' : 'CO_HOST')} className="p-2 hover:bg-black/5 rounded-full text-slate-600 transition-colors" title="Editar Asignación">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => { setManageRolesTarget({user, isHost, isCoHost}); setManageRolesModalOpen(true); }} className="p-2 hover:bg-black/5 rounded-full text-slate-600 transition-colors" title="Administrar Roles">
                                                <Shield className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })"""

content = re.sub(render_mapping_pattern, new_render_mapping, content, flags=re.DOTALL)

# Chunk 7: Modal
old_modal_pattern = r"            \{\/\* NEW HOST MODAL \*\/\}\n            \<NeoModal isOpen=\{roleChangeModalOpen\}.*?                \</div\>\n            \</NeoModal\>"

new_modal = """            {/* MANAGE ROLES MODAL */}
            <NeoModal isOpen={manageRolesModalOpen} onClose={() => setManageRolesModalOpen(false)} title="Administrar Roles">
                <div className="space-y-6">
                    {manageRolesTarget && (
                        <>
                            <div className="bg-slate-50 border-2 border-black p-4 flex items-center gap-4">
                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center font-black text-xl border-2 border-black text-black">
                                    {manageRolesTarget.user.name.charAt(0)}
                                </div>
                                <div>
                                    <div className="text-[10px] font-black uppercase text-slate-500 mb-0.5">Usuario</div>
                                    <div className="text-lg font-black uppercase leading-none">{manageRolesTarget.user.name}</div>
                                </div>
                            </div>

                            <div className="space-y-4 py-2">
                                <p className="text-sm font-medium text-slate-600 text-center">
                                    Puedes asignar múltiples roles al mismo usuario. Activa o desactiva los roles según corresponda.
                                </p>

                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between p-4 border-2 border-black rounded-xl cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleToggleRoleFromModal('HOST', !manageRolesTarget.isHost)}>
                                        <div className="flex items-center gap-3">
                                            <Shield className="w-5 h-5 text-yellow-600" />
                                            <span className="font-black uppercase text-sm">Anfitrión</span>
                                        </div>
                                        <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${manageRolesTarget.isHost ? 'bg-black' : 'bg-slate-300'}`}>
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${manageRolesTarget.isHost ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between p-4 border-2 border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleToggleRoleFromModal('CO_HOST', !manageRolesTarget.isCoHost)}>
                                        <div className="flex items-center gap-3">
                                            <Shield className="w-5 h-5 text-slate-500" />
                                            <span className="font-black uppercase text-sm text-slate-700">Co-Anfitrión</span>
                                        </div>
                                        <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${manageRolesTarget.isCoHost ? 'bg-black' : 'bg-slate-300'}`}>
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${manageRolesTarget.isCoHost ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t-2 border-slate-100">
                                <button
                                    onClick={() => setManageRolesModalOpen(false)}
                                    className="px-6 py-2 bg-black text-white text-xs font-black uppercase rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </NeoModal>"""

content = re.sub(old_modal_pattern, new_modal, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done refactoring HostsManagementPanel.tsx")
