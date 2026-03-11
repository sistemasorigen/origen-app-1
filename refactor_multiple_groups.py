import sys
import re

file_path = "c:\\Users\\nacho\\OneDrive\\Desktop\\Origen App\\origen-app\\origen-app\\components\\groups\\HostsManagementPanel.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add unassignGroup function
unassign_code = """
    const unassignGroup = async (userId: string, groupId: string, roleType: 'HOST' | 'CO_HOST') => {
        if (!window.confirm(`¿Estás seguro de quitar a este usuario del grupo?`)) return;
        setIsLoading(true);
        try {
            const group = groups.find(g => g.id === groupId);
            if (group) {
                const updatePayload = { ...group };
                if (roleType === 'HOST') (updatePayload as any).host_id = null;
                else (updatePayload as any).co_host_id = null;
                await updateGroupDirect(updatePayload);
                onUpdate(); // refresh groups
            }
        } catch (err) {
            console.error(err);
            alert('Error al quitar asignación');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveAssignment = async () =>"""

content = content.replace("    const handleSaveAssignment = async () =>", unassign_code, 1)

# 2. Update handleSaveAssignment to not remove previous group
old_handle_save = """    const handleSaveAssignment = async () => {
        if (!selectedUser) return;
        const groupToUpdate = groups.find(g => g.id === targetGroupId);
        setIsLoading(true);

        try {
            // 1. Remove from old group
            const previousGroup = groups.find(g =>
                (assignmentRole === 'HOST' && g.host_id === selectedUser.id) ||
                (assignmentRole === 'CO_HOST' && g.co_host_id === selectedUser.id)
            );

            if (previousGroup && previousGroup.id !== targetGroupId) {
                const updatePayload = { ...previousGroup };
                if (assignmentRole === 'HOST') (updatePayload as any).host_id = null;
                else (updatePayload as any).co_host_id = null;
                await updateGroupDirect(updatePayload);
            }

            // 2. Add to new group
            if (targetGroupId && groupToUpdate) {
                const updatePayload = { ...groupToUpdate };
                if (assignmentRole === 'HOST') (updatePayload as any).host_id = selectedUser.id;
                else (updatePayload as any).co_host_id = selectedUser.id;
                await updateGroupDirect(updatePayload);
            }

            onUpdate();
            setIsAssignmentModalOpen(false);
            fetchRoleUsers();
        } catch (err) {
            console.error(err);
            alert('Error al asignar grupo');
        } finally {
            setIsLoading(false);
        }
    };"""

new_handle_save = """    const handleSaveAssignment = async () => {
        if (!selectedUser) return;
        const groupToUpdate = groups.find(g => g.id === targetGroupId);
        setIsLoading(true);

        try {
            // We now support multiple groups, so we simply add the new assignment
            // without removing them from previous groups.
            if (targetGroupId && groupToUpdate) {
                const updatePayload = { ...groupToUpdate };
                if (assignmentRole === 'HOST') (updatePayload as any).host_id = selectedUser.id;
                else (updatePayload as any).co_host_id = selectedUser.id;
                await updateGroupDirect(updatePayload);
            }

            onUpdate();
            setIsAssignmentModalOpen(false);
            setTargetGroupId(''); // reset
        } catch (err) {
            console.error(err);
            alert('Error al asignar grupo');
        } finally {
            setIsLoading(false);
        }
    };"""

content = content.replace(old_handle_save, new_handle_save)

# 3. Modify openAssignmentModal to not pre-fill targetGroupId since we are adding a new one
old_open_modal = """    const openAssignmentModal = (user: User, role: 'HOST' | 'CO_HOST') => {
        setSelectedUser(user);
        setAssignmentRole(role);
        // Find if user is already assigned to a group to pre-fill
        const assignedGroup = groups.find(g =>
            (role === 'HOST' && g.host_id === user.id) ||
            (role === 'CO_HOST' && g.co_host_id === user.id)
        );
        setTargetGroupId(assignedGroup?.id || '');
        setIsAssignmentModalOpen(true);
    };"""

new_open_modal = """    const openAssignmentModal = (user: User, role: 'HOST' | 'CO_HOST') => {
        setSelectedUser(user);
        setAssignmentRole(role);
        setTargetGroupId(''); // Reset since we are just adding a new group
        setIsAssignmentModalOpen(true);
    };"""
content = content.replace(old_open_modal, new_open_modal)

# 4. Modify the `assignedGroup` logic in the map loop
old_group_logic = """                            const { user, isHost, isCoHost } = item;
                            const assignedGroup = groups.find(g => g.host_id === user.id || g.co_host_id === user.id);

                            let groupStatusText = '';
                            let groupStatusBadge = '';
                            let groupStatusDot = '';
                            
                            if (assignedGroup) {
                                const isFinished = assignedGroup.status === 'finished' || (assignedGroup.endDate && assignedGroup.endDate < new Date().toISOString().split('T')[0]);
                                if (isFinished) {
                                    groupStatusText = 'Finalizado';
                                    groupStatusBadge = 'bg-slate-100 text-slate-600';
                                    groupStatusDot = 'bg-slate-500';
                                } else if (assignedGroup.status === 'approved') {
                                    groupStatusText = 'Activo';
                                    groupStatusBadge = 'bg-green-100 text-green-700';
                                    groupStatusDot = 'bg-green-500';
                                } else if (assignedGroup.status === 'rejected') {
                                    groupStatusText = 'Rechazado';
                                    groupStatusBadge = 'bg-red-100 text-red-700';
                                    groupStatusDot = 'bg-red-500';
                                } else {
                                    groupStatusText = 'Pendiente';
                                    groupStatusBadge = 'bg-yellow-100 text-yellow-700';
                                    groupStatusDot = 'bg-yellow-500';
                                }
                            }"""

new_group_logic = """                            const { user, isHost, isCoHost } = item;
                            const assignedGroups = groups.filter(g => g.host_id === user.id || g.co_host_id === user.id);"""

content = content.replace(old_group_logic, new_group_logic)

# 5. Modify Mobile rendering
old_mobile_rendering = """                                        <div className="pl-[60px]">
                                            {assignedGroup ? (
                                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                                    <div className={`w-2 h-2 rounded-full ${groupStatusDot}`} />
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-medium truncate">{assignedGroup.name}</span>
                                                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-sm ${groupStatusBadge}`}>
                                                                {groupStatusText}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] uppercase text-slate-400">{assignedGroup.meetingDay} {assignedGroup.meetingTime}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button onClick={() => openAssignmentModal(user, isHost ? 'HOST' : 'CO_HOST')} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                                                    <Plus className="w-3 h-3" />
                                                    Asignar a un Grupo
                                                </button>
                                            )}
                                        </div>"""

new_mobile_rendering = """                                        <div className="pl-[60px]">
                                            <div className="flex flex-col gap-2">
                                                {assignedGroups.map(assignedGroup => {
                                                    let groupStatusText = 'Pendiente';
                                                    let groupStatusBadge = 'bg-yellow-100 text-yellow-700';
                                                    let groupStatusDot = 'bg-yellow-500';
                                                    
                                                    const isFinished = assignedGroup.status === 'finished' || (assignedGroup.endDate && assignedGroup.endDate < new Date().toISOString().split('T')[0]);
                                                    if (isFinished) {
                                                        groupStatusText = 'Finalizado';
                                                        groupStatusBadge = 'bg-slate-100 text-slate-600';
                                                        groupStatusDot = 'bg-slate-500';
                                                    } else if (assignedGroup.status === 'approved') {
                                                        groupStatusText = 'Activo';
                                                        groupStatusBadge = 'bg-green-100 text-green-700';
                                                        groupStatusDot = 'bg-green-500';
                                                    } else if (assignedGroup.status === 'rejected') {
                                                        groupStatusText = 'Rechazado';
                                                        groupStatusBadge = 'bg-red-100 text-red-700';
                                                        groupStatusDot = 'bg-red-500';
                                                    }
                                                    
                                                    return (
                                                        <div key={assignedGroup.id} className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-2 h-2 rounded-full shrink-0 ${groupStatusDot}`} />
                                                                <div className="flex flex-col">
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="font-medium truncate">{assignedGroup.name}</span>
                                                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-sm ${groupStatusBadge}`}>
                                                                            {groupStatusText}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[10px] uppercase text-slate-400">{assignedGroup.meetingDay} {assignedGroup.meetingTime}</span>
                                                                </div>
                                                            </div>
                                                            <button 
                                                              onClick={() => unassignGroup(user.id, assignedGroup.id, assignedGroup.host_id === user.id ? 'HOST' : 'CO_HOST')}
                                                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                              title="Quitar asignación"
                                                            >
                                                              <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                                <button onClick={() => openAssignmentModal(user, isHost ? 'HOST' : 'CO_HOST')} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 w-max mt-1">
                                                    <Plus className="w-3 h-3" />
                                                    {assignedGroups.length > 0 ? "Asignar a otro Grupo" : "Asignar a un Grupo"}
                                                </button>
                                            </div>
                                        </div>"""

content = content.replace(old_mobile_rendering, new_mobile_rendering)

# 6. Modify Desktop rendering
old_desktop_rendering = """                                        <div className="col-span-4 pl-0">
                                            {assignedGroup ? (
                                                <div onClick={() => openAssignmentModal(user, isHost ? 'HOST' : 'CO_HOST')} className="group cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg border border-transparent hover:border-black/10 hover:bg-white transition-all w-full">
                                                    <div className={`w-2 h-2 rounded-full shrink-0 ${groupStatusDot}`} />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-xs font-bold uppercase truncate">{assignedGroup.name}</p>
                                                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-sm ${groupStatusBadge}`}>
                                                                {groupStatusText}
                                                            </span>
                                                        </div>
                                                        <p className="text-[9px] text-slate-500 uppercase">{assignedGroup.meetingDay} {assignedGroup.meetingTime}</p>
                                                    </div>
                                                    <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 ml-auto shrink-0" />
                                                </div>
                                            ) : (
                                                <button onClick={() => openAssignmentModal(user, isHost ? 'HOST' : 'CO_HOST')} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-500 text-[10px] font-bold uppercase rounded-md hover:border-black hover:text-black hover:bg-white transition-all flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-red-400" />
                                                    Sin Asignar
                                                </button>
                                            )}
                                        </div>"""

new_desktop_rendering = """                                        <div className="col-span-4 pl-0">
                                            <div className="flex flex-col gap-1.5 w-full">
                                                {assignedGroups.map(assignedGroup => {
                                                    let groupStatusText = 'Pendiente';
                                                    let groupStatusBadge = 'bg-yellow-100 text-yellow-700';
                                                    let groupStatusDot = 'bg-yellow-500';
                                                    
                                                    const isFinished = assignedGroup.status === 'finished' || (assignedGroup.endDate && assignedGroup.endDate < new Date().toISOString().split('T')[0]);
                                                    if (isFinished) {
                                                        groupStatusText = 'Finalizado';
                                                        groupStatusBadge = 'bg-slate-100 text-slate-600';
                                                        groupStatusDot = 'bg-slate-500';
                                                    } else if (assignedGroup.status === 'approved') {
                                                        groupStatusText = 'Activo';
                                                        groupStatusBadge = 'bg-green-100 text-green-700';
                                                        groupStatusDot = 'bg-green-500';
                                                    } else if (assignedGroup.status === 'rejected') {
                                                        groupStatusText = 'Rechazado';
                                                        groupStatusBadge = 'bg-red-100 text-red-700';
                                                        groupStatusDot = 'bg-red-500';
                                                    }

                                                    return (
                                                        <div key={assignedGroup.id} className="group/item flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-black/20 hover:shadow-sm transition-all w-full">
                                                            <div className={`w-2 h-2 rounded-full shrink-0 ${groupStatusDot}`} />
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-xs font-bold uppercase truncate">{assignedGroup.name}</p>
                                                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-sm ${groupStatusBadge}`}>
                                                                        {groupStatusText}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[9px] text-slate-500 uppercase">{assignedGroup.meetingDay} {assignedGroup.meetingTime}</p>
                                                            </div>
                                                            <button 
                                                                onClick={() => unassignGroup(user.id, assignedGroup.id, assignedGroup.host_id === user.id ? 'HOST' : 'CO_HOST')}
                                                                className="opacity-0 group-hover/item:opacity-100 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all shrink-0"
                                                                title="Quitar de este grupo"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                                
                                                <button onClick={() => openAssignmentModal(user, isHost ? 'HOST' : 'CO_HOST')} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-500 text-[10px] font-bold uppercase rounded-md hover:border-black hover:text-black hover:bg-slate-50 transition-all flex items-center gap-2 w-max mt-1">
                                                    <Plus className="w-3 h-3" />
                                                    {assignedGroups.length > 0 ? "Asignar Otro" : "Asignar a un Grupo"}
                                                </button>
                                            </div>
                                        </div>"""

content = content.replace(old_desktop_rendering, new_desktop_rendering)

# 7. Modify the modal text warning
old_modal_warning = "<span>Al guardar, este usuario será asignado como {assignmentRole === 'HOST' ? 'Anfitrión' : 'Co-Anfitrión'} y removido de cualquier otro grupo donde tuviera ese rol.</span>"
new_modal_warning = "<span>Al guardar, este usuario será asignado como {assignmentRole === 'HOST' ? 'Anfitrión' : 'Co-Anfitrión'} a este nuevo grupo, conservando sus otras asignaciones si las tuviera.</span>"

content = content.replace(old_modal_warning, new_modal_warning)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Refactored successfully")
