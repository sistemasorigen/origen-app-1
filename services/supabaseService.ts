
import { supabase } from './supabaseClient';
import { db } from './dbService';
import { Group, StoreProduct, StoreOrder, AppConfig, GroupRegistration, InfoPointProduct, Movement, Baptism, ChildPresentation, Loan, AppEvent, MovementType, AppSettings, User, UserRole, ProductType, INFO_POINT_SIZES, GroupCategory, GroupTag, LeaderApplication, AuditLog, DropoutRequest, CoordinatorVariant } from '../types';

// Helper de temporadas — replicado de Grupos.tsx
const getSeasonFromDate = (
    dateStr?: string | null
): 'S1' | 'S2' | 'S3' | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr + 'T12:00:00');
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const md = m * 100 + d;
    if (md >= 323 && md <= 531) return 'S1';
    if (md >= 629 && md <= 823) return 'S2';
    if (md >= 1005 && md <= 1129) return 'S3';
    return null;
};

// EXPORTED standalone function for direct use
export async function insertGroupDirect(group: Group): Promise<Group | null> {
  console.log('[insertGroupDirect] Called with:', group.name);
  const dbRow: Record<string, any> = {
    id: group.id,
    name: group.name,
    status: group.status || 'pending', // Default to pending for new groups
    leader_name: group.leaderName || '',
    leader_surname: group.leaderSurname || '',
    leader_phone: group.leaderPhone || '',
    meeting_day: group.meetingDay || 'Lunes',
    meeting_time: group.meetingTime || '20:00',
    start_date: group.startDate || null,
    end_date: group.endDate || null,
    location: group.location || '',
    members_count: group.membersCount || 0,
    max_capacity: group.maxCapacity || 12,
    description: group.description || '',
    image_url: group.imageUrl || '',
    category_id: group.categoryId || null,
    tags: group.tags || [],
    // New Fields
    co_host_first_name: group.coHostFirstName || '',
    co_host_last_name: group.coHostLastName || '',
    min_age: group.minAge || 0,
    max_age: group.maxAge || 100,
    target_gender: group.targetGender || 'Mixto'
  };

  // Add host_id if provided
  if ((group as any).host_id) {
    dbRow.host_id = (group as any).host_id;
  }

  // Add co_host_id if provided
  if ((group as any).co_host_id) {
    dbRow.co_host_id = (group as any).co_host_id;
  }

  console.log('[insertGroupDirect] Sending to Supabase...');
  const { data, error } = await supabase.from('groups').insert(dbRow).select().single();
  console.log('[insertGroupDirect] Result:', { data, error });

  if (error) {
    // If duplicate, try update
    if (error.code === '23505') {
      console.log('[insertGroupDirect] Duplicate key, trying update...');
      return await updateGroupDirect(group);
    }
    console.error('[insertGroupDirect] Error:', error);
    return null;
  }

  return transformDbRowToGroup(data);
}

// Update group
export async function updateGroupDirect(group: Group): Promise<Group | null> {
  console.log('[updateGroupDirect] Called with:', group.id, group.name);

  // First, verify the group exists
  const { data: existingGroup, error: checkError } = await supabase
    .from('groups')
    .select('id')
    .eq('id', group.id)
    .maybeSingle();

  if (checkError) {
    console.error('[updateGroupDirect] Error checking group existence:', checkError);
  }

  if (!existingGroup) {
    console.error('[updateGroupDirect] Group not found with ID:', group.id);
    console.log('[updateGroupDirect] Attempting insert instead...');
    // Try insert if group doesn't exist
    return await insertGroupDirect(group);
  }

  const dbRow = {
    name: group.name,
    status: group.status, // Include status in updates
    leader_name: group.leaderName || '',
    leader_surname: group.leaderSurname || '',
    leader_phone: group.leaderPhone || '',
    meeting_day: group.meetingDay || 'Lunes',
    meeting_time: group.meetingTime || '20:00',
    start_date: group.startDate || null,
    end_date: group.endDate || null,
    location: group.location || '',
    members_count: group.membersCount || 0,
    max_capacity: group.maxCapacity || 12,
    description: group.description || '',
    image_url: group.imageUrl || '',
    category_id: group.categoryId || null,
    tags: group.tags || [],
    host_id: (group as any).host_id || null,
    co_host_id: (group as any).co_host_id || null,
    co_host_first_name: group.coHostFirstName || '',
    co_host_last_name: group.coHostLastName || '',
    min_age: group.minAge || 0,
    max_age: group.maxAge || 100,
    target_gender: group.targetGender || 'Mixto'
  };

  console.log('[updateGroupDirect] Updating with data:', dbRow);
  console.log('[updateGroupDirect] HOST ID in payload:', dbRow.host_id);

  // Use RPC for consistent updates (bypassing Client RLS limitations)
  console.log('[updateGroupDirect] Calling RPC admin_update_group_v2');
  const { data: updatedData, error: rpcError } = await supabase.rpc('admin_update_group_v2', {
    p_group_id: group.id,
    p_group_data: dbRow
  });

  if (rpcError) {
    console.error('[updateGroupDirect] RPC Error:', rpcError);
    return null;
  }

  console.log('[updateGroupDirect] RPC Success');

  if (updatedData) {
    return transformDbRowToGroup(updatedData);
  }

  return null;
}

// Delete group - Uses RPC to bypass RLS and cascade delete
export async function deleteGroupDirect(id: string): Promise<boolean> {
  console.log('[deleteGroupDirect] Called with:', id);

  // Use RPC function to bypass RLS and delete associated registrations/attendance
  const { data, error } = await supabase.rpc('admin_delete_group', {
    p_group_id: id
  });

  if (error) {
    console.error('[deleteGroupDirect] RPC Error:', error);
    return false;
  }

  console.log('[deleteGroupDirect] Success, result:', data);
  return data === true;
}

// Helper to transform DB row to Group
function transformDbRowToGroup(data: any): Group {
  return {
    id: data.id,
    name: data.name,
    status: data.status || 'pending', // Map status field
    leaderName: data.leader_name || '',
    leaderSurname: data.leader_surname || '',
    leaderPhone: data.leader_phone || '',
    meetingDay: data.meeting_day || 'Lunes',
    meetingTime: data.meeting_time || '20:00',
    startDate: data.start_date || '',
    endDate: data.end_date || '',
    location: data.location || '',
    membersCount: data.members_count || 0,
    maxCapacity: data.max_capacity || 12,
    description: data.description || '',
    imageUrl: data.image_url || '',
    categoryId: data.category_id || '',
    tags: data.tags || [],
    host_id: data.host_id,
    co_host_id: data.co_host_id,
    coHostFirstName: data.co_host_first_name || '',
    coHostLastName: data.co_host_last_name || '',
    maxAge: data.max_age || 100,
    targetGender: data.target_gender || 'Mixto',
    registrations: []
  };
}


export const supabaseService = {
  // --- NOTIFICATIONS ---
  async createAppNotification(userId: string, title: string, message: string, type: string, actionUrl: string | null = null, metadata: any = null): Promise<boolean> {
    try {
      if (!userId) {
        console.warn('[Notifications] Cannot create notification without user_id');
        return false;
      }
      
      const { error } = await supabase
        .from('app_notifications')
        .insert({
          user_id: userId,
          title,
          message,
          type,
          action_url: actionUrl,
          metadata
        });

      if (error) {
        console.error('[Notifications] Error creating notification:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[Notifications] Exception creating notification:', err);
      return false;
    }
  },

  // --- AUTHENTICATION & USERS (REAL SUPABASE AUTH) ---

  // A. Sign Up
  async signUpUser(firstName: string, lastName: string, phone: string, email: string, password: string, age: number, gender: string): Promise<{ success: boolean; error?: string }> {
    try {
      const fullName = `${firstName} ${lastName}`.trim();

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: fullName,
            phone: phone,
            age: age,
            gender: gender,
          },
          emailRedirectTo: `${window.location.origin}/#/verify-email`
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        // The trigger 'on_auth_user_created' (in DB) handles the insertion into public.users
        return { success: true };
      }

      return { success: false, error: "No se pudo crear el usuario." };

    } catch (err: any) {
      console.error("Sign Up Error:", err);
      return { success: false, error: err.message || "Error desconocido al registrarse." };
    }
  },

  // B. Sign In
  async signInUser(email: string, password: string): Promise<{ user: User | null; error?: string }> {
    try {
      // 1. Auth with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError || !authData.user) {
        return { user: null, error: "Credenciales inválidas." };
      }

      // 2. Fetch User Details from public.users (Roles, etc.)
      const { data: user, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (dbError || !user) {
        console.warn("Profile fetch error or missing:", dbError);

        // Self-Healing: Try to create the user profile if it doesn't exist
        // This handles cases where the Trigger failed or wasn't set up when user was created.
        if (!user && authData.user) {
          console.log("Attempting self-repair for missing profile...");
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
              id: authData.user.id,
              email: authData.user.email,
              name: authData.user.user_metadata?.name || authData.user.email?.split('@')[0],
              role: UserRole.VIEWER,
              is_active: true
            })
            .select()
            .single();

          if (!createError && newUser) {
            // Recovered! Use this new user
            const appUser: User = {
              id: newUser.id,
              name: newUser.name,
              email: newUser.email,
              role: newUser.role as UserRole,
              roles: (newUser.roles || [newUser.role]) as UserRole[],
              isActive: newUser.is_active,
              linkedGroupId: newUser.linked_group_id,
              volunteerRoles: newUser.volunteer_roles || [],
              assignedCategory: newUser.assigned_category || undefined
            };
            return { user: appUser };
          } else {
            console.error("Self-repair failed:", createError);
            // Return specific error from creation failure if available
            return {
              user: null,
              error: `Error al crear perfil: ${createError?.message || "Error desconocido"}. Revisa tus permisos.`
            };
          }
        }

        // If we get here, it means we couldn't even try self-repair (shouldn't happen if authData.user exists)
        return { user: null, error: "Error al cargar perfil (Usuario no encontrado)." };
      }

      if (dbError) {
        // Log the exact database error if it wasn't just "missing"
        console.error("Critical Profile Fetch Error:", dbError);
        return { user: null, error: `Error interno de base de datos: ${dbError.message}` };
      }

      if (!user.is_active) {
        await supabase.auth.signOut();
        return { user: null, error: "Tu cuenta está inactiva." };
      }

      // 3. Map to App User Object
      const appUser: User = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as UserRole,
        roles: (user.roles || [user.role]) as UserRole[],
        isActive: user.is_active,
        linkedGroupId: user.linked_group_id,
        volunteerRoles: user.volunteer_roles || [],
        phone: authData.user.user_metadata?.phone || authData.user.phone || '',
        age: user.age,
        gender: user.gender,
        birthDate: user.birth_date,
        assignedCategory: user.assigned_category || undefined,
        coordinatorVariant: user.coordinator_variant as CoordinatorVariant | undefined
      };

      return { user: appUser };

    } catch (err: any) {
      console.error("Login Error:", err);
      return { user: null, error: "Error de conexión." };
    }
  },

  // C. Sign Out
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },

  // D. Reset Password (Send Email)
  async resetPasswordForEmail(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Use just the origin - Supabase will append #access_token=xxx&type=recovery...
      // App.tsx will detect type=recovery and show UpdatePassword component
      const redirectTo = window.location.origin + '/';
      console.log("Solicitando reseteo de password para:", email, "RedirectTo:", redirectTo);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo,
      });

      if (error) {
        console.error("Supabase Reset Password Error:", error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      console.error("Reset Password Exception:", err);
      return { success: false, error: err.message || "Error desconocido." };
    }
  },

  // E. Update Password (Logged in user)
  async updateUserPassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // F. Duplicate Check (Supabase Auth handles this, but we can keep a soft check if needed, 
  // or just rely on 'signUpUser' returning an error)
  async checkDuplicateUser(email: string, firstName: string, lastName: string): Promise<{ exists: boolean; reason?: string }> {
    // We'll rely on signUp error for email.
    // We can check name duplicate manually if we want to enforce unique names
    const fullName = `${firstName} ${lastName}`.trim();

    const { data: nameCheck } = await supabase
      .from('users')
      .select('id')
      .ilike('name', fullName)
      .maybeSingle();

    if (nameCheck) return { exists: true, reason: 'Ya existe un usuario con ese Nombre y Apellido.' };

    return { exists: false };
  },

  // --- AUDIT LOGS ---
  async getAuditLogs(): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select(`
        *,
        users:changed_by (name)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }

    return data.map((log: any) => ({
      ...log,
      actor_name: log.users?.name || 'Sistema'
    }));
  },

  // --- USER MANAGEMENT (ADMIN) ---

  async getAllUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name');

      if (error) throw error;

      return data.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role as UserRole,
        roles: (u.roles && u.roles.length > 0 ? u.roles : [u.role]) as UserRole[],
        isActive: u.is_active,
        linkedGroupId: u.linked_group_id,
        volunteerRoles: u.volunteer_roles || [],
        phone: u.phone,
        age: u.age,
        gender: u.gender,
        birthDate: u.birth_date,
        coordinatorVariant: u.coordinator_variant as CoordinatorVariant | undefined
      }));
    } catch (error) {
      console.warn('Supabase Error (getAllUsers) - Using Local Fallback:', JSON.stringify(error));
      return db.getUsers();
    }
  },

  async adminCreateUser(user: User, _password?: string): Promise<User | null> {
    // Call Edge Function to create auth.users record (which triggers public.users creation)
    const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-manage-user', {
      body: { action: 'CREATE', email: user.email, password: _password, name: user.name }
    });

    if (edgeError || !edgeData?.success) {
      console.error('Error creating auth user:', edgeError || edgeData?.error);
      return null;
    }

    const newUserId = edgeData.data.id;

    // Upsert into public.users to ensure roles and other specific admin data are saved
    const { data, error } = await supabase
      .from('users')
      .upsert({
        id: newUserId,
        name: user.name,
        email: user.email,
        role: user.role,
        roles: user.roles && user.roles.length > 0 ? user.roles : [user.role],
        is_active: user.isActive,
        linked_group_id: user.linkedGroupId,
        volunteer_roles: user.volunteerRoles
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating user roles in public.users:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role as UserRole,
      roles: (data.roles && data.roles.length > 0 ? data.roles : [data.role]) as UserRole[],
      isActive: data.is_active,
      linkedGroupId: data.linked_group_id,
      volunteerRoles: data.volunteer_roles || []
    };
  },

  async updateUser(user: User, _password?: string): Promise<boolean> {
    if (_password) {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-manage-user', {
        body: { action: 'UPDATE_PASSWORD', userId: user.id, password: _password }
      });
      if (edgeError || !edgeData?.success) {
        console.error('Error updating password via Edge Function:', edgeError || edgeData?.error);
        return false;
      }
    }

    const updates = {
      name: user.name,
      email: user.email,
      role: user.role,
      roles: user.roles,
      is_active: user.isActive,
      linked_group_id: user.linkedGroupId,
      volunteer_roles: user.volunteerRoles,
      coordinator_variant: user.coordinatorVariant
    };

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      console.error('Error updating user:', error);
      return false;
    }
    return true;
  },

  async updateUserRole(userId: string, role: string, variant?: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.rpc('admin_assign_role', {
      target_user_id: userId,
      new_role: role,
      new_variant: variant || null
    });

    if (error) {
      console.error('RPC Error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  async removeUserRole(userId: string, roleToRemove: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.rpc('admin_remove_role', {
      target_user_id: userId,
      role_to_remove: roleToRemove
    });

    if (error) {
      console.error('RPC Error on remove:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  // Update user profile fields (phone, age, gender, birthDate) - used for OAuth profile completion
  async updateUserProfile(userId: string, profileData: { phone?: string; age?: number; gender?: string; birthDate?: string; avatarUrl?: string }): Promise<boolean> {
    // We use upsert here because for Google Sign In users, the public.users row might not exist yet
    // if the trigger failed or hasn't fired. We need to Ensure it exists.

    // First, we need to get the email/name from auth metadata if we are inserting a new row
    // BUT, we only have the profile data here. 
    // Ideally, we should fetch the user from auth first to get the email/name if we need to insert.
    // However, to keep it simple and robust:

    // Attempt UPDATE first (most common case is user exists)
    const { error: updateError, data } = await supabase
      .from('users')
      .update({
        phone: profileData.phone,
        age: profileData.age,
        gender: profileData.gender,
        birth_date: profileData.birthDate,
        ...(profileData.avatarUrl !== undefined && { avatar_url: profileData.avatarUrl }),
        is_active: true // Activate them if they are completing profile
      })
      .eq('id', userId)
      .select();

    if (!updateError && data && data.length > 0) {
      return true;
    }

    // If update failed (likely no row), we MUST doing a full INSERT/UPSERT.
    // But we need the email/name.
    console.warn("Update failed or no row (Google User?), attempting UPSERT with Auth Data fetch...");

    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser || authUser.id !== userId) {
      console.error("Critical: Auth user mismatch during profile completion.");
      return false;
    }

    const { error: upsertError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email: authUser.email,
        name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuario',
        role: UserRole.VIEWER,
        is_active: true,
        phone: profileData.phone,
        age: profileData.age,
        gender: profileData.gender,
        birth_date: profileData.birthDate
      });

    if (upsertError) {
      console.error('Error upserting user profile:', upsertError);
      return false;
    }
    return true;
  },

  // Link a user to a group explicitly (updates linked_group_id)
  async linkUserToGroup(userId: string, groupId: string): Promise<boolean> {
    console.log(`[linkUserToGroup] Linking user ${userId} to group ${groupId}`);
    const { data, error } = await supabase
      .from('users')
      .update({ linked_group_id: groupId })
      .eq('id', userId)
      .select();

    console.log('[linkUserToGroup] Result:', { data, error });

    if (error) {
      console.error('[linkUserToGroup] Error:', error);
      return false;
    }
    return true;
  },

  async deleteUser(id: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('admin_delete_user', {
      target_user_id: id
    });

    if (error) {
      console.error('Error deleting user (RPC):', error);
      return false;
    }

    if (data && !data.success) {
      console.error('Delete user failed:', data.error);
      return false;
    }

    return true;
  },

  // --- LEADER APPLICATIONS ---

  async saveLeaderApplication(app: LeaderApplication): Promise<boolean> {
    const { error } = await supabase
      .from('leader_applications')
      .insert({
        id: app.id,
        first_name: app.firstName,
        last_name: app.lastName,
        email: app.email,
        phone: app.phone,
        completed_leader_course: app.completedLeaderCourse,
        completed_hiciste_crecer: app.completedHicisteCrecer,
        completed_volunteer_training: app.completedVolunteerTraining,
        attends_origen: app.attendsOrigen,
        applicant_id: app.applicantId,
        status: app.status
      });

    if (error) {
      console.error('Error saving application:', error);
      return false;
    }
    return true;
  },

  async getLeaderApplications(): Promise<LeaderApplication[]> {
    const { data, error } = await supabase
      .from('leader_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching applications (using local fallback):', error.message);
      return db.getLeaderApplications();
    }

    return data.map((d: any) => ({
      id: d.id,
      firstName: d.first_name,
      lastName: d.last_name,
      email: d.email,
      phone: d.phone,
      completedLeaderCourse: d.completed_leader_course,
      completedHicisteCrecer: d.completed_hiciste_crecer,
      completedVolunteerTraining: d.completed_volunteer_training,
      attendsOrigen: d.attends_origen,
      applicantId: d.applicant_id,
      status: d.status,
      createdAt: d.created_at
    }));
  },

  async updateLeaderApplicationStatus(id: string, status: 'APPROVED' | 'REJECTED'): Promise<boolean> {
    const { error } = await supabase
      .from('leader_applications')
      .update({ status: status })
      .eq('id', id);

    if (error) {
      console.error('Error updating application status:', error);
      return false;
    }
    return true;
  },

  // --- ANALYTICS FOR PASTORES MODULE ---

  // 1. Inventory Stock Data (Current Snapshot)
  async getInventoryStockData(): Promise<{ name: string; Remeras: number; Buzos: number }[]> {
    const { data, error } = await supabase.from('info_products').select('*');
    if (error || !data) return [];

    // Group by Size and Sum Type
    const stockMap: Record<string, { Remeras: number; Buzos: number }> = {};

    // Initialize map with all sizes to ensure X-axis order
    INFO_POINT_SIZES.forEach(size => {
      stockMap[size] = { Remeras: 0, Buzos: 0 };
    });

    data.forEach((p: any) => {
      if (!stockMap[p.size]) stockMap[p.size] = { Remeras: 0, Buzos: 0 };
      if (p.type === 'Remeras') stockMap[p.size].Remeras += p.stock;
      if (p.type === 'Buzos') stockMap[p.size].Buzos += p.stock;
    });

    return Object.entries(stockMap).map(([name, counts]) => ({
      name,
      ...counts
    }));
  },

  // 2. Baptism Time Series
  async getBaptismTimeSeries(start: string, end: string): Promise<{ registered: any[]; completed: any[] }> {
    // Registered (using snake_case columns)
    const { data: regData } = await supabase
      .from('baptisms')
      .select('registration_date')
      .gte('registration_date', start)
      .lte('registration_date', end);

    // Completed (using snake_case columns)
    const { data: compData } = await supabase
      .from('baptisms')
      .select('completion_date')
      .gte('completion_date', start)
      .lte('completion_date', end)
      .eq('is_pending', 0); // is_pending

    const aggregateByDate = (items: any[], dateField: string) => {
      const agg: Record<string, number> = {};
      items?.forEach(i => {
        const date = i[dateField]?.split('T')[0];
        if (date) agg[date] = (agg[date] || 0) + 1;
      });
      return Object.entries(agg).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
    };

    return {
      registered: aggregateByDate(regData || [], 'registration_date'),
      completed: aggregateByDate(compData || [], 'completion_date')
    };
  },

  // 3. Presentation Time Series
  async getPresentationTimeSeries(start: string, end: string): Promise<{ registered: any[]; completed: any[] }> {
    // 1. Registered (Anotados) -> Based on created_at (Entry Date)
    const { data: regData } = await supabase
      .from('presentations')
      .select('created_at')
      .gte('created_at', start)
      .lte('created_at', end);

    // 2. Completed (Realizados) -> Based on scheduledDate IF isPending is 0
    // Logic: If it's marked completed/not pending, it means it was realized on the scheduled date.
    const { data: compData } = await supabase
      .from('presentations')
      .select('scheduledDate')
      .gte('scheduledDate', start)
      .lte('scheduledDate', end)
      .eq('isPending', 0);

    const aggregateByDate = (items: any[], dateField: string) => {
      const agg: Record<string, number> = {};
      items?.forEach(i => {
        // Split 'T' for ISO strings (created_at), works fine for YYYY-MM-DD strings (scheduledDate) too.
        const date = i[dateField]?.split('T')[0];
        if (date) agg[date] = (agg[date] || 0) + 1;
      });
      return Object.entries(agg).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
    };

    return {
      registered: aggregateByDate(regData || [], 'created_at'),
      completed: aggregateByDate(compData || [], 'scheduledDate')
    };
  },

  // 4. Group Registration Chart Data
  async getGroupRegistrationChartData(start: string, end: string): Promise<{ name: string; value: number; startDate?: string; endDate?: string; status?: string }[]> {
    try {
      console.log('[Reports] Fetching group registration data...');

      // Step 1: Get all registrations
      const { data: registrations, error: regError } = await supabase
        .from('group_registrations')
        .select('*');

      if (regError) {
        console.error('[Reports] Error fetching registrations:', regError);
        return [];
      }

      console.log('[Reports] Registrations found:', registrations?.length || 0);

      if (!registrations || registrations.length === 0) {
        return [];
      }

      // Step 2: Get all groups with endDate
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('id, name, start_date, end_date, status');

      if (groupsError) {
        console.error('[Reports] Error fetching groups:', groupsError);
        return [];
      }

      console.log('[Reports] Groups found:', groups?.length || 0);

      // Create a map of group_id -> group info
      const groupMap: Record<string, {
          name: string;
          startDate?: string;
          endDate?: string;
          status?: string;
      }> = {};
      (groups || []).forEach(g => {
        groupMap[g.id] = {
            name: g.name,
            startDate: g.start_date,
            endDate: g.end_date,
            status: g.status
        };
      });

      // Aggregate by group
      const agg: Record<string, {
          count: number;
          startDate?: string;
          endDate?: string;
          status?: string;
      }> = {};

      registrations.forEach((reg: any) => {
        const groupInfo = groupMap[reg.group_id] || { name: 'Desconocido', endDate: undefined, status: undefined };
        const groupName = groupInfo.name;

        if (!agg[groupName]) {
          agg[groupName] = {
              count: 0,
              startDate: groupInfo.startDate,
              endDate: groupInfo.endDate,
              status: groupInfo.status
          };
        }
        agg[groupName].count += (reg.partner_data ? 2 : 1);
      });

      const result = Object.entries(agg)
        .map(([name, data]) => ({
            name,
            value: data.count,
            startDate: data.startDate,
            endDate: data.endDate,
            status: data.status
        }))
        .sort((a, b) => b.value - a.value);

      console.log('[Reports] Final chart data:', result);
      return result;
    } catch (err) {
      console.error('[Reports] Exception in getGroupRegistrationChartData:', err);
      return [];
    }
  },

  // 5. Group Analytics by Category
  async getGroupAnalyticsByCategory(
    startDate: string,
    endDate: string,
    groupStatus: 'ACTIVOS' | 'FINALIZADOS' | 'TODOS'
  ): Promise<{ categoryId: string; categoryName: string; categoryColor: string; count: number; percentage: number }[]> {
    try {
      console.log('[Analytics] Fetching category analytics...', { startDate, endDate, groupStatus });

      // Get all groups with their categories
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select(`
          id,
          category_id,
          end_date,
          group_categories!inner(id, name, color)
        `);

      if (groupsError) {
        console.error('[Analytics] Error fetching groups:', groupsError);
        return [];
      }

      if (!groups || groups.length === 0) {
        return [];
      }

      // Filter groups by status
      const now = new Date();
      const filteredGroups = groups.filter((g: any) => {
        if (groupStatus === 'ACTIVOS') {
          return !g.end_date || new Date(g.end_date) >= now;
        } else if (groupStatus === 'FINALIZADOS') {
          return g.end_date && new Date(g.end_date) < now;
        }
        return true; // TODOS
      });

      // Get registrations within date range
      const { data: registrations, error: regError } = await supabase
        .from('group_registrations')
        .select('group_id, partner_data')
        .gte('timestamp', startDate)
        .lte('timestamp', endDate);

      if (regError) {
        console.error('[Analytics] Error fetching registrations:', regError);
        return [];
      }

      // Count registrations per category
      const categoryCount: Record<string, { name: string; color: string; count: number }> = {};

      registrations?.forEach((reg: any) => {
        const group = filteredGroups.find((g: any) => g.id === reg.group_id);
        if (group && group.group_categories) {
          const catId = group.category_id;
          const catName = group.group_categories.name;
          const catColor = group.group_categories.color;

          if (!categoryCount[catId]) {
            categoryCount[catId] = { name: catName, color: catColor, count: 0 };
          }
          categoryCount[catId].count += (reg.partner_data ? 2 : 1);
        }
      });

      // Calculate percentages
      const total = Object.values(categoryCount).reduce((sum, cat) => sum + cat.count, 0);

      const result = Object.entries(categoryCount).map(([id, data]) => ({
        categoryId: id,
        categoryName: data.name,
        categoryColor: data.color,
        count: data.count,
        percentage: total > 0 ? Math.round((data.count / total) * 100) : 0
      })).sort((a, b) => b.count - a.count);

      console.log('[Analytics] Category analytics result:', result);
      return result;
    } catch (err) {
      console.error('[Analytics] Exception in getGroupAnalyticsByCategory:', err);
      return [];
    }
  },

  // 6. Group Analytics by Tags
  async getGroupAnalyticsByTags(
    startDate: string,
    endDate: string,
    groupStatus: 'ACTIVOS' | 'FINALIZADOS' | 'TODOS'
  ): Promise<{ tagName: string; count: number; percentage: number }[]> {
    try {
      console.log('[Analytics] Fetching tag analytics...', { startDate, endDate, groupStatus });

      // Get all groups with tags
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('id, tags, end_date');

      if (groupsError) {
        console.error('[Analytics] Error fetching groups:', groupsError);
        return [];
      }

      if (!groups || groups.length === 0) {
        return [];
      }

      // Filter groups by status
      const now = new Date();
      const filteredGroups = groups.filter((g: any) => {
        if (groupStatus === 'ACTIVOS') {
          return !g.end_date || new Date(g.end_date) >= now;
        } else if (groupStatus === 'FINALIZADOS') {
          return g.end_date && new Date(g.end_date) < now;
        }
        return true; // TODOS
      });

      // Get registrations within date range
      const { data: registrations, error: regError } = await supabase
        .from('group_registrations')
        .select('group_id, partner_data')
        .gte('timestamp', startDate)
        .lte('timestamp', endDate);

      if (regError) {
        console.error('[Analytics] Error fetching registrations:', regError);
        return [];
      }

      // Count registrations per tag
      const tagCount: Record<string, number> = {};

      registrations?.forEach((reg: any) => {
        const group = filteredGroups.find((g: any) => g.id === reg.group_id);
        if (group && group.tags && Array.isArray(group.tags)) {
          group.tags.forEach((tag: string) => {
            tagCount[tag] = (tagCount[tag] || 0) + (reg.partner_data ? 2 : 1);
          });
        }
      });

      // Calculate percentages
      const total = Object.values(tagCount).reduce((sum, count) => sum + count, 0);

      const result = Object.entries(tagCount).map(([name, count]) => ({
        tagName: name,
        count: count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      })).sort((a, b) => b.count - a.count);

      console.log('[Analytics] Tag analytics result:', result);
      return result;
    } catch (err) {
      console.error('[Analytics] Exception in getGroupAnalyticsByTags:', err);
      return [];
    }
  },

  // 7. Detailed Analytics for Export
  async getDetailedAnalyticsForExport(
    type: 'CATEGORIAS' | 'ETIQUETAS' | 'TODAS',
    startDate: string,
    endDate: string,
    groupStatus: 'ACTIVOS' | 'FINALIZADOS' | 'TODOS'
  ): Promise<{ tipo: string; nombre: string; cantidadInscritos: number; estadoGrupo: string; fechaInicio: string }[]> {
    try {
      console.log('[Analytics] Fetching detailed export data...', { type, startDate, endDate, groupStatus });

      // Get all groups with full details
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select(`
          id,
          category_id,
          tags,
          end_date,
          start_date,
          group_categories(name)
        `);

      if (groupsError) {
        console.error('[Analytics] Error fetching groups:', groupsError);
        return [];
      }

      if (!groups || groups.length === 0) {
        return [];
      }

      // Filter groups by status
      const now = new Date();
      const filteredGroups = groups.filter((g: any) => {
        if (groupStatus === 'ACTIVOS') {
          return !g.end_date || new Date(g.end_date) >= now;
        } else if (groupStatus === 'FINALIZADOS') {
          return g.end_date && new Date(g.end_date) < now;
        }
        return true; // TODOS
      });

      // Get registrations within date range
      const { data: registrations, error: regError } = await supabase
        .from('group_registrations')
        .select('group_id, partner_data')
        .gte('timestamp', startDate)
        .lte('timestamp', endDate);

      if (regError) {
        console.error('[Analytics] Error fetching registrations:', regError);
        return [];
      }

      const results: { tipo: string; nombre: string; cantidadInscritos: number; estadoGrupo: string; fechaInicio: string }[] = [];

      // Process categories
      if (type === 'CATEGORIAS' || type === 'TODAS') {
        const categoryCount: Record<string, { name: string; count: number; dates: string[] }> = {};

        registrations?.forEach((reg: any) => {
          const group = filteredGroups.find((g: any) => g.id === reg.group_id);
          if (group && group.category_id && group.group_categories) {
            const catId = group.category_id;
            const catName = group.group_categories.name;

            if (!categoryCount[catId]) {
              categoryCount[catId] = { name: catName, count: 0, dates: [] };
            }
            categoryCount[catId].count += (reg.partner_data ? 2 : 1);
            if (group.start_date) {
              categoryCount[catId].dates.push(group.start_date);
            }
          }
        });

        Object.values(categoryCount).forEach(cat => {
          const earliestDate = cat.dates.length > 0
            ? cat.dates.sort()[0].split('T')[0]
            : 'N/A';

          results.push({
            tipo: 'Categoría',
            nombre: cat.name,
            cantidadInscritos: cat.count,
            estadoGrupo: groupStatus === 'TODOS' ? 'Mixto' : groupStatus === 'ACTIVOS' ? 'Activo' : 'Finalizado',
            fechaInicio: earliestDate
          });
        });
      }

      // Process tags
      if (type === 'ETIQUETAS' || type === 'TODAS') {
        const tagCount: Record<string, { count: number; dates: string[] }> = {};

        registrations?.forEach((reg: any) => {
          const group = filteredGroups.find((g: any) => g.id === reg.group_id);
          if (group && group.tags && Array.isArray(group.tags)) {
            group.tags.forEach((tag: string) => {
              if (!tagCount[tag]) {
                tagCount[tag] = { count: 0, dates: [] };
              }
              tagCount[tag].count += (reg.partner_data ? 2 : 1);
              if (group.start_date) {
                tagCount[tag].dates.push(group.start_date);
              }
            });
          }
        });

        Object.entries(tagCount).forEach(([tagName, data]) => {
          const earliestDate = data.dates.length > 0
            ? data.dates.sort()[0].split('T')[0]
            : 'N/A';

          results.push({
            tipo: 'Etiqueta',
            nombre: tagName,
            cantidadInscritos: data.count,
            estadoGrupo: groupStatus === 'TODOS' ? 'Mixto' : groupStatus === 'ACTIVOS' ? 'Activo' : 'Finalizado',
            fechaInicio: earliestDate
          });
        });
      }

      console.log('[Analytics] Export data result:', results);
      return results.sort((a, b) => b.cantidadInscritos - a.cantidadInscritos);
    } catch (err) {
      console.error('[Analytics] Exception in getDetailedAnalyticsForExport:', err);
      return [];
    }
  },

  // --- APP CONFIG ---
  async getAppConfig(): Promise<AppConfig | null> {
    const { data, error } = await supabase
      .from('app_config')
      .select('config')
      .eq('id', 'global')
      .single();

    if (error) {
      console.warn('Error fetching config (using local fallback):', JSON.stringify(error));
      return null;
    }
    return data?.config as AppConfig;
  },

  async saveAppConfig(config: AppConfig): Promise<boolean> {
    const { error } = await supabase
      .from('app_config')
      .upsert({ id: 'global', config });

    if (error) {
      console.error('Error saving config:', JSON.stringify(error));
      return false;
    }
    return true;
  },

  // --- GROUPS MODULE ---

  // Helper to transform DB row (snake_case) to Group (camelCase)
  _dbRowToGroup(row: any): Group {
    return {
      id: row.id,
      name: row.name,
      status: row.status || 'pending', // Map status field
      leaderName: row.leader_name || '',
      leaderSurname: row.leader_surname || '',
      leaderPhone: row.leader_phone || '',
      meetingDay: row.meeting_day || 'Lunes',
      meetingTime: row.meeting_time || '20:00',
      startDate: row.start_date || '',
      endDate: row.end_date || '',
      location: row.location || '',
      membersCount: row.members_count || 0,
      maxCapacity: row.max_capacity || 12,
      description: row.description || '',
      imageUrl: row.image_url || '',
      categoryId: row.category_id || '',
      tags: row.tags || [],
      host_id: row.host_id,
      co_host_id: row.co_host_id,
      // New Fields
      coHostFirstName: row.co_host_first_name || '',
      coHostLastName: row.co_host_last_name || '',
      minAge: row.min_age || 0,
      maxAge: row.max_age || 100,
      targetGender: row.target_gender || 'Mixto',
      adminNote: row.admin_note || '', // Admin review note
      registrations: (row.registrations || []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id || null,
        firstName: r.first_name || '',
        lastName: r.last_name || '',
        email: r.email || '',
        phone: r.phone || '',
        dni: r.dni,
        timestamp: r.timestamp || '',
        groupId: r.group_id || '',
        status: (r.status || 'PENDING').toUpperCase() as 'PENDING' | 'APPROVED' | 'REJECTED',
        // Couples registration fields
        partnerData: r.partner_data || null,
        partnerUserId: r.partner_user_id || null
      }))
    };
  },

  // Helper to transform Group (camelCase) to DB row (snake_case)
  _groupToDbRow(group: Group) {
    return {
      id: group.id,
      name: group.name,
      status: group.status || 'pending', // Include status
      leader_name: group.leaderName || '',
      leader_surname: group.leaderSurname || '',
      leader_phone: group.leaderPhone || '',
      meeting_day: group.meetingDay || 'Lunes',
      meeting_time: group.meetingTime || '20:00',
      start_date: group.startDate || null,
      end_date: group.endDate || null,
      location: group.location || '',
      members_count: group.membersCount || 0,
      max_capacity: group.maxCapacity || 12,
      description: group.description || '',
      image_url: group.imageUrl || '',
      category_id: group.categoryId || null,
      tags: group.tags || [],
      host_id: (group as any).host_id,
      co_host_first_name: group.coHostFirstName || '',
      co_host_last_name: group.coHostLastName || '',
      min_age: group.minAge || 0,
      max_age: group.maxAge || 100,
      target_gender: group.targetGender || 'Mixto',
      admin_note: group.adminNote || null // Admin review note
    };
  },



  // Get groups for public view (only approved status)
  async getGroups(): Promise<Group[]> {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*, registrations:group_registrations(*)')
        .eq('status', 'approved'); // Only show approved groups to public

      if (error) {
        console.error('[Groups] Error fetching:', error);
        throw error;
      }

      console.log('[Groups] Fetched approved groups from DB:', data?.length || 0, 'groups');
      return (data || []).map((row: any) => this._dbRowToGroup(row));
    } catch (error) {
      console.warn('[Groups] Using local fallback due to error');
      return db.getGroups();
    }
  },

  // Get ALL groups for admin view (pending, approved, rejected)
  async getGroupsForAdmin(): Promise<Group[]> {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*, registrations:group_registrations(*)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Groups Admin] Error fetching:', error);
        throw error;
      }

      console.log('[Groups Admin] Fetched all groups:', data?.length || 0, 'groups');
      return (data || []).map((row: any) => this._dbRowToGroup(row));
    } catch (error) {
      console.warn('[Groups Admin] Using local fallback due to error');
      return db.getGroups();
    }
  },

  // Get groups by host ID (for host's own dashboard - shows all statuses)
  async getGroupsByHost(hostId: string): Promise<Group[]> {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*, registrations:group_registrations(*)')
        .or(`host_id.eq.${hostId},co_host_id.eq.${hostId}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Groups by Host] Error fetching:', error);
        throw error;
      }

      console.log('[Groups by Host] Fetched groups for host:', hostId, 'count:', data?.length || 0);
      return (data || []).map((row: any) => this._dbRowToGroup(row));
    } catch (error) {
      console.warn('[Groups by Host] Error, returning empty array');
      return [];
    }
  },

  // Update group status (for approval workflow) with optional admin note
  async updateGroupStatus(groupId: string, status: 'pending' | 'approved' | 'rejected', adminNote?: string): Promise<boolean> {
    try {
      const updateData: any = { status };

      // Clear notes if approved, otherwise update if note provided
      if (status === 'approved') {
        updateData.admin_note = null;
      } else if (adminNote !== undefined) {
        updateData.admin_note = adminNote || null;
      }

      // Update status and fetch metadata for notifications in one atomic operation
      const { data: groupData, error: updateError } = await supabase
        .from('groups')
        .update(updateData)
        .eq('id', groupId)
        .select('name, host_id, co_host_id, meeting_day')
        .single();

      if (updateError) {
        console.error('[Groups] Error updating status:', updateError);
        return false;
      }

      console.log('[Groups] Status updated:', groupId, '->', status, adminNote ? '(with note)' : '');

      // Send in-app notifications to host/co-host
      if (status === 'approved' || status === 'rejected') {
        if (groupData) {
          const isApproved = status === 'approved';
          const title = isApproved ? '¡Tu grupo fue aprobado! 🎉' : 'Actualización sobre tu grupo';
          const message = isApproved
            ? `Tu grupo "${groupData.name}" ha sido aprobado. Recuerda registrar asistencia cada ${groupData.meeting_day || 'reunión'}.`
            : `Tu grupo "${groupData.name}" no ha podido ser aprobado en este momento.${adminNote ? ` Motivo: ${adminNote}` : ''}`;
          const type = isApproved ? 'GROUP_APPROVED' : 'GROUP_REJECTED';
          const actionUrl = '/host-dashboard';

          if (groupData.host_id) {
            await supabaseService.createAppNotification(groupData.host_id, title, message, type, actionUrl);
          }
          if (groupData.co_host_id) {
            await supabaseService.createAppNotification(groupData.co_host_id, title, message, type, actionUrl);
          }
        } else {
          console.warn('[Groups] Could not send notification: Group data missing after update');
        }
      }

      return true;
    } catch (error) {
      console.error('[Groups] Exception updating status:', error);
      return false;
    }
  },

  // Re-open a finished/rejected group: Delete all registrations and attendance, reset members count
  async reopenGroup(groupId: string): Promise<boolean> {
    try {
      console.log('[Groups] Re-opening group:', groupId);

      // 1. Delete all registrations for this group
      const { error: regError } = await supabase
        .from('group_registrations')
        .delete()
        .eq('group_id', groupId);

      if (regError) {
        console.error('[Groups] Error deleting registrations:', regError);
        return false;
      }
      console.log('[Groups] Deleted all registrations for group:', groupId);

      // 2. Delete all attendance records for this group
      const { error: attError } = await supabase
        .from('group_attendance')
        .delete()
        .eq('group_id', groupId);

      if (attError) {
        console.warn('[Groups] Error deleting attendance (may not exist):', attError);
        // Non-fatal, continue
      } else {
        console.log('[Groups] Deleted all attendance for group:', groupId);
      }

      // 3. Reset members_count to 0 and set status to 'pending'
      const { error: updateError } = await supabase
        .from('groups')
        .update({
          members_count: 0,
          status: 'pending',
          end_date: null // Clear the end date so it's not immediately marked as finished
        })
        .eq('id', groupId);

      if (updateError) {
        console.error('[Groups] Error resetting group:', updateError);
        return false;
      }

      console.log('[Groups] Group re-opened successfully:', groupId);
      return true;
    } catch (error) {
      console.error('[Groups] Exception re-opening group:', error);
      return false;
    }
  },

  // Clear group registrations and attendance (used when updating status to pending manually)
  async clearGroupParticipants(groupId: string): Promise<boolean> {
    try {
      // 1. Delete registrations
      const { error: regError } = await supabase
        .from('group_registrations')
        .delete()
        .eq('group_id', groupId);

      if (regError) throw regError;

      // 2. Delete attendance
      const { error: attError } = await supabase
        .from('group_attendance')
        .delete()
        .eq('group_id', groupId);

      if (attError) throw attError;

      // 3. Reset members count
      const { error: groupError } = await supabase
        .from('groups')
        .update({ members_count: 0 })
        .eq('id', groupId);

      if (groupError) throw groupError;

      return true;
    } catch (error) {
      console.error('[Groups] Error clearing participants:', error);
      return false;
    }
  },

  async saveGroup(group: Group): Promise<Group | null> {
    try {
      const { registrations, ...groupWithoutRegs } = group;

      // Transform to snake_case for DB
      const dbRow = {
        id: groupWithoutRegs.id,
        name: groupWithoutRegs.name,
        leader_name: groupWithoutRegs.leaderName || '',
        leader_surname: groupWithoutRegs.leaderSurname || '',
        leader_phone: groupWithoutRegs.leaderPhone || '',
        meeting_day: groupWithoutRegs.meetingDay || 'Lunes',
        meeting_time: groupWithoutRegs.meetingTime || '20:00',
        start_date: groupWithoutRegs.startDate || null,
        location: groupWithoutRegs.location || '',
        members_count: groupWithoutRegs.membersCount || 0,
        max_capacity: groupWithoutRegs.maxCapacity || 12,
        description: groupWithoutRegs.description || '',
        image_url: groupWithoutRegs.imageUrl || '',
        category_id: groupWithoutRegs.categoryId || null,
        tags: groupWithoutRegs.tags || [],
        host_id: (groupWithoutRegs as any).host_id,
        // New Fields
        co_host_first_name: groupWithoutRegs.coHostFirstName || '',
        co_host_last_name: groupWithoutRegs.coHostLastName || '',
        max_age: groupWithoutRegs.maxAge || 100,
        target_gender: groupWithoutRegs.targetGender || 'Mixto'
      };

      console.log('[Groups] saveGroup called with:', dbRow);

      // Add timeout to diagnose hanging issue
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT: Supabase request took longer than 10s')), 10000)
      );

      const insertPromise = supabase
        .from('groups')
        .insert(dbRow)
        .select()
        .single();

      console.log('[Groups] Starting insert with 10s timeout...');

      let data, error;
      try {
        const result = await Promise.race([insertPromise, timeoutPromise]) as any;
        data = result.data;
        error = result.error;
      } catch (timeoutError) {
        console.error('[Groups] TIMEOUT ERROR:', timeoutError);
        return null;
      }

      console.log('[Groups] Insert result:', { data, error });

      if (error) {
        // If it's a duplicate, try update
        if (error.code === '23505') {
          console.log('[Groups] Duplicate, trying update...');
          const { data: updated, error: updateError } = await supabase
            .from('groups')
            .update(dbRow)
            .eq('id', dbRow.id)
            .select()
            .single();

          if (updateError) {
            console.error('[Groups] Update error:', updateError);
            return null;
          }
          console.log('[Groups] Updated:', updated?.id);
          return this._transformDbToGroup(updated);
        }
        console.error('[Groups] Save error:', error);
        return null;
      }

      console.log('[Groups] Saved successfully:', data?.id);
      return this._transformDbToGroup(data);
    } catch (error) {
      console.error('[Groups] Save exception:', error);
      return null;
    }
  },

  _transformDbToGroup(data: any): Group {
    return {
      id: data.id,
      name: data.name,
      leaderName: data.leader_name || '',
      leaderSurname: data.leader_surname || '',
      leaderPhone: data.leader_phone || '',
      meetingDay: data.meeting_day || 'Lunes',
      meetingTime: data.meeting_time || '20:00',
      startDate: data.start_date || '',
      location: data.location || '',
      membersCount: data.members_count || 0,
      maxCapacity: data.max_capacity || 12,
      description: data.description || '',
      imageUrl: data.image_url || '',
      categoryId: data.category_id || '',
      tags: data.tags || [],
      registrations: []
    };
  },

  async deleteGroup(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[Groups] Delete error:', error);
        return false;
      }
      console.log('[Groups] Deleted:', id);
      return true;
    } catch (error) {
      console.error('[Groups] Delete exception:', error);
      return false;
    }
  },



  // --- ADMIN GROUP HELPERS ---
  async uploadGroupImage(file: File): Promise<string | null> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('group-covers')
        .upload(filePath, file);

      if (uploadError) {
        console.error('[Groups] Image upload error:', uploadError);
        return null;
      }

      const { data } = supabase.storage
        .from('group-covers')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('[Groups] Image upload exception:', error);
      return null;
    }
  },

  async getAvailableHosts(searchTerm: string = ''): Promise<User[]> {
    try {
      let query = supabase
        .from('users')
        .select('*')
        .eq('role', 'ANFITRION')
        .eq('isActive', true);

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[Groups] Error fetching hosts:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[Groups] Exception fetching hosts:', error);
      return [];
    }
  },

  async registerMemberToGroup(registration: GroupRegistration): Promise<boolean> {
    try {
      // 1. Check if registration already exists (Duplicate/Re-apply check)
      // We check by email or phone for this specific group
      const { data: existing } = await supabase
        .from('group_registrations')
        .select('*')
        .eq('group_id', registration.groupId)
        .or(`email.eq.${registration.email},phone.eq.${registration.phone}`)
        .maybeSingle();

      if (existing) {
        // If pending or approved, we shouldn't be here (frontend should block), but double check
        if (existing.status === 'PENDING' || existing.status === 'APPROVED') {
          console.warn('[Groups] User already registered with status:', existing.status);
          return false;
        }

        // If REJECTED, we update to PENDING (Re-application)
        if (existing.status === 'REJECTED') {
          console.log('[Groups] Reactivating REJECTED registration');
          const { error: updateError } = await supabase
            .from('group_registrations')
            .update({
              status: 'PENDING',
              timestamp: new Date().toISOString(), // Update timestamp to now
              first_name: registration.firstName, // Update details if changed
              last_name: registration.lastName,
              phone: registration.phone
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error('[Groups] Re-activation error:', updateError);
            return false;
          }
          return true;
        }
      }

      // 2. New Registration (Insert)
      const dbReg: Record<string, any> = {
        id: registration.id,
        first_name: registration.firstName,
        last_name: registration.lastName,
        email: registration.email || '',
        phone: registration.phone || '',
        dni: registration.dni,
        timestamp: registration.timestamp || new Date().toISOString(),
        group_id: registration.groupId,
        status: 'PENDING',
        user_id: registration.userId // Link to system user if available
      };

      // Add partner_data for couples registration
      if (registration.partnerData) {
        dbReg.partner_data = registration.partnerData;
      }

      // Add partner_user_id if partner has an account
      if (registration.partnerUserId) {
        dbReg.partner_user_id = registration.partnerUserId;
      }

      console.log('[Groups] Registering new member:', dbReg);

      const { error: insertError } = await supabase
        .from('group_registrations')
        .insert(dbReg);

      if (insertError) {
        console.error('[Groups] Registration insert error:', insertError);
        return false;
      }

      // Increment member count (Only for fresh inserts? Or strictly only when approved? 
      // Usually member count reflects APPROVED members, but logic here incremented on request. 
      // User requirement implies status management. Let's keep logic simple: 
      // If we are strictly "Pending", maybe we shouldn't increment count yet? 
      // Current system seems to increment on request. I will LEAVE IT as is for consistency, 
      // although technically pending shouldn't take a seat.)

      /* 
         NOTE: Previous logic incremented members_count on INSERT. 
         Ideally member count should be for APPROVED. 
         But to minimalize regression risks, I will keep it matching previous behavior 
         unless explicitly asked to fix "capacity" logic. 
         The prompt focuses on Button Logic and Duplicate Prevention.
      */

      const { data: group } = await supabase
        .from('groups')
        .select('members_count')
        .eq('id', registration.groupId)
        .single();

      if (group) {
        const newCount = (group.members_count || 0) + 1;
        await supabase
          .from('groups')
          .update({ members_count: newCount })
          .eq('id', registration.groupId);
      }

      console.log('[Groups] Registered successfully:', registration.id);
      return true;
    } catch (error) {
      console.error('[Groups] Registration exception:', error);
      return false;
    }
  },

  // Check if partner email already exists in a group (for couples registration duplicate protection)
  async checkPartnerEmailExists(groupId: string, partnerEmail: string): Promise<boolean> {
    try {
      const emailLower = partnerEmail.toLowerCase().trim();

      // Check if email exists as main user OR in partner_data
      // Only check PENDING and APPROVED registrations (ignore REJECTED)
      const { data, error } = await supabase
        .from('group_registrations')
        .select('id, email, partner_data, status')
        .eq('group_id', groupId)
        .in('status', ['PENDING', 'APPROVED']); // Ignore REJECTED

      if (error) {
        console.error('[Groups] Check partner email error:', error);
        return false; // On error, allow submission (let backend handle)
      }

      if (!data) return false;

      // Check each registration
      for (const reg of data) {
        // Check main user email
        if (reg.email?.toLowerCase().trim() === emailLower) {
          console.log('[Groups] Partner email matches existing main user');
          return true;
        }
        // Check partner_data email
        if (reg.partner_data?.email?.toLowerCase().trim() === emailLower) {
          console.log('[Groups] Partner email matches existing partner');
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('[Groups] Check partner email exception:', error);
      return false;
    }
  },

  // Find a user by email to link partner accounts
  async findUserByEmail(email: string): Promise<{ id: string; name: string } | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .ilike('email', email.toLowerCase().trim())
        .maybeSingle();

      if (error) {
        console.error('[Users] Find by email error:', error);
        return null;
      }

      if (data) {
        console.log('[Users] Found user by email:', data.name);
        return { id: data.id, name: data.name };
      }

      return null;
    } catch (error) {
      console.error('[Users] Find by email exception:', error);
      return null;
    }
  },

  // NEW: Get registration status for a user in a group (checks both main user and partner)
  // This enables "Dual Visibility" - both people in a couple see the same status
  async getCoupleRegistrationStatus(groupId: string, userId?: string, email?: string): Promise<'PENDING' | 'APPROVED' | 'REJECTED' | null> {
    try {
      if (!userId && !email) return null;

      console.log('[Groups] getCoupleRegistrationStatus called:', { groupId, userId, email });

      // Try RPC first (most robust)
      try {
        const { data, error } = await supabase.rpc('get_couple_registration_status', {
          p_group_id: groupId,
          p_user_id: userId || null,
          p_email: email || ''
        });

        if (!error && data) {
          console.log('[Groups] RPC get_couple_registration_status result:', data);
          return data as 'PENDING' | 'APPROVED' | 'REJECTED';
        }

        if (error) {
          console.warn('[Groups] RPC get_couple_registration_status failed, falling back:', error.message);
        }
      } catch (rpcError) {
        console.warn('[Groups] RPC exception, falling back:', rpcError);
      }

      // Fallback: Manual query
      const { data, error } = await supabase
        .from('group_registrations')
        .select('status, user_id, partner_user_id, partner_data, email')
        .eq('group_id', groupId);

      if (error || !data) {
        console.error('[Groups] Fallback query error:', error);
        return null;
      }

      // Check each registration for match
      for (const reg of data) {
        const isMainUser = reg.user_id === userId;
        const isPartnerById = reg.partner_user_id === userId;
        const isPartnerByEmail = email && reg.partner_data?.email?.toLowerCase().trim() === email.toLowerCase().trim();
        const isMainByEmail = email && reg.email?.toLowerCase().trim() === email.toLowerCase().trim();

        if (isMainUser || isPartnerById || isPartnerByEmail || isMainByEmail) {
          console.log('[Groups] Found matching registration:', { status: reg.status, isMainUser, isPartnerById, isPartnerByEmail });
          return reg.status as 'PENDING' | 'APPROVED' | 'REJECTED';
        }
      }

      return null;
    } catch (error) {
      console.error('[Groups] getCoupleRegistrationStatus exception:', error);
      return null;
    }
  },

  async getGroupRegistrations(groupId: string): Promise<GroupRegistration[]> {
    try {
      const { data, error } = await supabase
        .from('group_registrations')
        .select('*')
        .eq('group_id', groupId)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('[Groups] Fetch registrations error:', error);
        return [];
      }

      return data.map((row: any) => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        dni: row.dni,
        timestamp: row.timestamp,
        groupId: row.group_id,
        status: row.status || 'PENDING',
        userId: row.user_id,
        partnerUserId: row.partner_user_id,
        partnerData: row.partner_data
      }));
    } catch (error) {
      console.error('[Groups] Fetch registrations exception:', error);
      return [];
    }
  },

  // NEW METHOD: Get all registrations for a specific user (by email, user_id, or partner_user_id)
  async getUserRegistrations(userId?: string, email?: string): Promise<GroupRegistration[]> {
    try {
      if (!userId && !email) return [];

      console.log('[Groups] getUserRegistrations called with:', { userId, email });

      // TRY RPC FIRST (Most robust for partners)
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_group_registrations');

        if (!rpcError && rpcData) {
          console.log('[Groups] RPC get_my_group_registrations success:', rpcData.length);
          return rpcData.map((row: any) => ({
            id: row.id,
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email,
            phone: row.phone,
            groupId: row.group_id,
            timestamp: row.timestamp,
            status: row.status,
            userId: row.user_id,
            partnerUserId: row.partner_user_id,
            partnerData: row.partner_data
          }));
        }
        if (rpcError) console.warn('[Groups] RPC failed (function might not exist yet), falling back to query:', rpcError.message);
      } catch (e) {
        console.warn('[Groups] RPC exception, falling back:', e);
      }

      // FALLBACK TO DIRECT QUERY (If RPC doesn't exist yet)
      let query = supabase.from('group_registrations').select('*');

      // logic: we want registrations where:
      // - user_id is the user's ID 
      // - email is the user's email
      // - partner_user_id is the user's ID (they're linked as partner)
      const str = [];
      if (userId) str.push(`user_id.eq.${userId}`);
      if (email) str.push(`email.ilike.${email}`);
      if (userId) str.push(`partner_user_id.eq.${userId}`); // Include registrations where user is partner

      console.log('[Groups] Query OR conditions:', str.join(','));

      if (str.length > 0) {
        query = query.or(str.join(','));
      } else {
        return [];
      }

      const { data, error } = await query;

      if (error) {
        console.error("[Groups] Error fetching user registrations:", error);
        return [];
      }

      console.log('[Groups] Found registrations (Fallback):', data?.length, data);

      return (data || []).map(row => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        groupId: row.group_id,
        timestamp: row.timestamp,
        status: row.status,
        userId: row.user_id,
        partnerUserId: row.partner_user_id,
        partnerData: row.partner_data
      }));
    } catch (err) {
      console.error("Exception fetching user registrations:", err);
      return [];
    }
  },

  // Safety net: Find registrations where I am the partner by email (in case partner_user_id wasn't linked)
  async getPartnerRegistrationsByEmail(email: string): Promise<GroupRegistration[]> {
    try {
      if (!email) return [];

      console.log('[Groups] Calling RPC get_registrations_by_partner_email for:', email);

      // Use RPC for case-insensitive JSON search
      const { data, error } = await supabase
        .rpc('get_registrations_by_partner_email', { p_email: email });

      if (error) {
        console.error('[Groups] Error fetching partner registrations by email RPC:', error);
        // Fallback to direct query if RPC fails
        return [];
      }

      console.log('[Groups] RPC get_registrations_by_partner_email success:', data?.length);

      return (data || []).map((row: any) => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        groupId: row.group_id,
        timestamp: row.timestamp,
        status: row.status,
        userId: row.user_id,
        partnerUserId: row.partner_user_id,
        partnerData: row.partner_data
      }));
    } catch (err) {
      console.error("Exception fetching partner registrations by email:", err);
      return [];
    }
  },

  async updateRegistrationStatus(id: string, status: 'APPROVED' | 'REJECTED'): Promise<boolean> {
    try {
      console.log('[Groups] Calling RPC manage_group_registration_v3 with:', { id, status });

      // Fetch user info for notification
      const { data: regInfo } = await supabase
        .from('group_registrations')
        .select(`
          user_id,
          partner_user_id,
          groups ( name )
        `)
        .eq('id', id)
        .single();

      // Directly call RPC - it handles all logic including permission checks
      const { data, error } = await supabase
        .rpc('manage_group_registration_v3', {
          p_registration_id: id,
          p_status: status
        } as { p_registration_id: string; p_status: string });

      if (error) {
        console.error('[Groups] RPC Error:', error);
        throw error;
      }

      console.log('[Groups] RPC Result:', data);

      // If REJECTED, also clear partner data to clean up
      if (status === 'REJECTED') {
        await supabase
          .from('group_registrations')
          .update({
            partner_data: null,
            partner_user_id: null
          })
          .eq('id', id);
        console.log('[Groups] Cleared partner data for rejected registration');
      }

      // Send notifications
      if (data === true && regInfo) {
        const groupData: any = regInfo.groups;
        const groupName = groupData?.name || 'un grupo';
        
        const notifTitle = status === 'APPROVED' ? 'Solicitud Aprobada' : 'Solicitud Rechazada';
        const notifMessage = status === 'APPROVED' 
            ? `Tu solicitud para unirte a ${groupName} ha sido aprobada.` 
            : `Tu solicitud para unirte a ${groupName} no ha podido ser aceptada en este momento.`;
        const type = status === 'APPROVED' ? 'REGISTRATION_APPROVED' : 'REGISTRATION_REJECTED';
        const actionUrl = '/';

        if (regInfo.user_id) {
          await supabaseService.createAppNotification(regInfo.user_id, notifTitle, notifMessage, type, actionUrl);
        }
        if (regInfo.partner_user_id) {
          await supabaseService.createAppNotification(regInfo.partner_user_id, notifTitle, notifMessage, type, actionUrl);
        }
      }

      // RPC returns true on success, false on failure
      return data === true;
    } catch (error) {
      console.error('[Groups] Update status error:', error);
      return false;
    }
  },

  async bulkRemoveGroupMembers(registrationIds: string[]): Promise<{ success: boolean; message: string }> {
    try {
      if (!registrationIds.length) return { success: false, message: 'No selected members' };

      console.log('[Groups] Calling RPC bulk_remove_group_members with:', registrationIds);

      const { data, error } = await supabase
        .rpc('bulk_remove_group_members', {
          p_registration_ids: registrationIds
        });

      if (error) {
        console.error('[Groups] Bulk delete error:', error);
        return { success: false, message: 'Error al eliminar miembros' };
      }

      return { success: true, message: 'Miembros eliminados correctamente' };
    } catch (err) {
      console.error('[Groups] Exception in bulk delete:', err);
      return { success: false, message: 'Error inesperado al eliminar' };
    }
  },

  async deleteGroupRegistration(registrationId: string, groupId: string): Promise<boolean> {
    console.log('[Groups] deleteGroupRegistration called with:', { registrationId, groupId });
    try {
      // First check if registration exists
      const { data: existing, error: checkError } = await supabase
        .from('group_registrations')
        .select('id')
        .eq('id', registrationId)
        .single();

      console.log('[Groups] Registration lookup:', { existing, checkError });

      if (checkError) {
        console.error('[Groups] Registration not found:', checkError);
        return false;
      }

      const { error: deleteError, count } = await supabase
        .from('group_registrations')
        .delete()
        .eq('id', registrationId);

      console.log('[Groups] Delete result:', { deleteError, count });

      if (deleteError) {
        console.error('[Groups] Registration delete error:', deleteError);
        return false;
      }

      // Decrement member count
      const { data: group } = await supabase
        .from('groups')
        .select('members_count')
        .eq('id', groupId)
        .single();

      if (group) {
        const newCount = Math.max(0, (group.members_count || 0) - 1);
        await supabase
          .from('groups')
          .update({ members_count: newCount })
          .eq('id', groupId);
      }

      console.log('[Groups] Registration deleted successfully');
      return true;
    } catch (error) {
      console.error('[Groups] Delete registration exception:', error);
      return false;
    }
  },

  // --- GROUPS CATEGORIES & TAGS ---

  async getGroupCategories(): Promise<GroupCategory[]> {
    try {
      const { data, error } = await supabase.from('group_categories').select('*');
      console.log('[Supabase] Categories loaded:', data, 'Error:', error);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn('[Categories] Using local fallback');
      return db.getCategories();
    }
  },

  async saveGroupCategory(category: GroupCategory): Promise<boolean> {
    try {
      console.log('[Categories] Saving:', category);
      const { error } = await supabase.from('group_categories').upsert(category);
      if (error) {
        console.error('[Categories] Save error:', error);
        throw error;
      }
      console.log('[Categories] Saved successfully');
      return true;
    } catch (error) {
      console.error('[Categories] Save exception:', error);
      return false;
    }
  },

  async deleteGroupCategory(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('group_categories').delete().eq('id', id);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[Categories] Delete error:', error);
      return false;
    }
  },

  async getGroupTags(): Promise<GroupTag[]> {
    try {
      const { data, error } = await supabase.from('group_tags').select('*');
      console.log('[Supabase] Tags loaded:', data, 'Error:', error);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn('[Tags] Using local fallback');
      return db.getTags();
    }
  },

  async saveGroupTag(tag: GroupTag): Promise<boolean> {
    try {
      console.log('[Tags] Saving:', tag);
      const { error } = await supabase.from('group_tags').upsert(tag);
      if (error) {
        console.error('[Tags] Save error:', error);
        throw error;
      }
      console.log('[Tags] Saved successfully');
      return true;
    } catch (error) {
      console.error('[Tags] Save exception:', error);
      return false;
    }
  },

  async deleteGroupTag(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('group_tags').delete().eq('id', id);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[Tags] Delete error:', error);
      return false;
    }
  },

  // --- STORE MODULE ---

  async getStoreProducts(): Promise<StoreProduct[]> {
    const { data, error } = await supabase
      .from('store_products')
      .select('*');

    if (error) {
      console.error('Error fetching products:', error);
      return [];
    }
    return data as StoreProduct[];
  },

  async saveStoreProduct(product: StoreProduct): Promise<StoreProduct | null> {
    const { data, error } = await supabase
      .from('store_products')
      .upsert(product)
      .select()
      .single();

    if (error) {
      console.error('Error saving product:', error);
      return null;
    }
    return data as StoreProduct;
  },

  async deleteStoreProduct(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('store_products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting product:', error);
      return false;
    }
    return true;
  },

  async getStoreOrders(): Promise<StoreOrder[]> {
    const { data, error } = await supabase
      .from('store_orders')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
      return [];
    }
    return data as StoreOrder[];
  },

  async createStoreOrder(order: StoreOrder): Promise<StoreOrder | null> {
    const { data, error } = await supabase
      .from('store_orders')
      .insert(order)
      .select()
      .single();

    if (error) {
      console.error('Error creating order:', error);
      return null;
    }
    return data as StoreOrder;
  },

  async updateOrderStatus(id: string, status: string): Promise<boolean> {
    const { error } = await supabase
      .from('store_orders')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.error('Error updating order status:', error);
      return false;
    }
    return true;
  },

  async updateStockFromOrder(items: any[], reverse: boolean = false): Promise<void> {
    for (const item of items) {
      const { data: product } = await supabase
        .from('store_products')
        .select('*')
        .eq('id', item.id)
        .single();

      if (product) {
        const sizeKey = item.selectedSize;
        const currentSizeInfo = product.sizes[sizeKey];

        if (currentSizeInfo) {
          const qty = Number(item.quantity);
          const newStock = reverse
            ? Number(currentSizeInfo.stock) + qty
            : Math.max(0, Number(currentSizeInfo.stock) - qty);

          const newSizes = {
            ...product.sizes,
            [sizeKey]: { ...currentSizeInfo, stock: newStock }
          };

          await supabase.from('store_products').update({ sizes: newSizes }).eq('id', item.id);
        }
      }
    }
  },

  // --- INFO POINT MODULE ---

  async getInfoProducts(): Promise<InfoPointProduct[]> {
    const { data, error } = await supabase.from('info_products').select('*');
    if (error) { console.error('Error fetching info products:', error); return []; }
    return data as InfoPointProduct[];
  },

  async saveInfoProduct(product: InfoPointProduct): Promise<void> {
    const { error } = await supabase.from('info_products').upsert(product);
    if (error) console.error('Error saving info product:', error);
  },

  async deleteInfoProduct(code: string): Promise<void> {
    const { error } = await supabase.from('info_products').delete().eq('code', code);
    if (error) console.error('Error deleting info product:', error);
  },

  async updateInfoProductPrices(type: ProductType, newPrice: number): Promise<void> {
    const { error } = await supabase.from('info_products').update({ price: newPrice }).eq('type', type);
    if (error) console.error('Error updating prices:', error);
  },

  async getInfoMovements(): Promise<Movement[]> {
    const { data, error } = await supabase.from('movements').select('*').order('date', { ascending: true });
    if (error) { console.error('Error fetching movements:', error); return []; }
    return data as Movement[];
  },

  async addInfoMovement(movement: Movement): Promise<void> {
    const { error } = await supabase.from('movements').insert(movement);
    if (error) {
      console.error('Error adding movement:', error);
      return;
    }

    const { data: product } = await supabase
      .from('info_products')
      .select('stock')
      .eq('code', movement.productCode)
      .single();

    if (product) {
      let newStock = product.stock;
      if (movement.type === 'Entrada') {
        newStock += movement.quantity;
      } else if (movement.type === 'Salida') {
        newStock = Math.max(0, newStock - movement.quantity);
      } else if (movement.type === 'Ajuste') {
        newStock = movement.quantity;
      }

      await supabase
        .from('info_products')
        .update({ stock: newStock })
        .eq('code', movement.productCode);
    }
  },

  async deleteInfoMovement(id: string): Promise<void> {
    const { error } = await supabase.from('movements').delete().eq('id', id);
    if (error) console.error('Error deleting movement:', error);
  },

  async getBaptisms(): Promise<Baptism[]> {
    const { data, error } = await supabase.from('baptisms').select('*').order('registration_date', { ascending: false });
    if (error) { console.error('Error fetching baptisms:', error); return []; }
    return data.map((item: any) => ({
      id: item.id,
      firstName: item.first_name,
      lastName: item.last_name,
      phone: item.phone,
      email: item.email,
      registrationDate: item.registration_date,
      completionDate: item.completion_date,
      isPending: item.is_pending,
      status: item.status
    })) as Baptism[];
  },

  async saveBaptism(baptism: Baptism): Promise<void> {
    const dbData = {
      id: baptism.id,
      first_name: baptism.firstName,
      last_name: baptism.lastName,
      phone: baptism.phone,
      email: baptism.email,
      registration_date: baptism.registrationDate,
      completion_date: baptism.completionDate,
      is_pending: baptism.isPending,
      status: baptism.status
    };
    const { error } = await supabase.from('baptisms').upsert(dbData);
    if (error) console.error('Error saving baptism:', error);
  },

  async deleteBaptism(id: string): Promise<void> {
    const { error } = await supabase.from('baptisms').delete().eq('id', id);
    if (error) console.error('Error deleting baptism:', error);
  },

  async getPresentations(): Promise<ChildPresentation[]> {
    const { data, error } = await supabase.from('presentations').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Error fetching presentations:', error); return []; }
    return data as ChildPresentation[];
  },

  async savePresentation(presentation: ChildPresentation): Promise<void> {
    const { error } = await supabase.from('presentations').upsert(presentation);
    if (error) console.error('Error saving presentation:', error);
  },

  async deletePresentation(id: string): Promise<void> {
    const { error } = await supabase.from('presentations').delete().eq('id', id);
    if (error) console.error('Error deleting presentation:', error);
  },

  async getLoans(): Promise<Loan[]> {
    const { data, error } = await supabase.from('loans').select('*').order('loan_date', { ascending: false });
    if (error) { console.error('Error fetching loans:', error); return []; }
    return data.map((item: any) => ({
      id: item.id,
      lenderName: item.lender_name,
      lenderSurname: item.lender_surname,
      itemType: item.item_type,
      itemSize: item.item_size,
      loanDate: item.loan_date,
      returnDate: item.return_date,
      status: item.status
    })) as Loan[];
  },

  async saveLoan(loan: Loan): Promise<void> {
    const dbData = {
      id: loan.id,
      lender_name: loan.lenderName,
      lender_surname: loan.lenderSurname,
      item_type: loan.itemType,
      item_size: loan.itemSize,
      loan_date: loan.loanDate,
      return_date: loan.returnDate,
      status: loan.status
    };
    const { error } = await supabase.from('loans').upsert(dbData);
    if (error) console.error('Error saving loan:', error);
  },

  async deleteLoan(id: string): Promise<void> {
    const { error } = await supabase.from('loans').delete().eq('id', id);
    if (error) console.error('Error deleting loan:', error);
  },

  async getEvents(): Promise<AppEvent[]> {
    const { data, error } = await supabase.from('app_events').select('*').order('date', { ascending: true });
    if (error) { console.error('Error fetching events:', error); return []; }
    
    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      date: row.date,
      link: row.link,
      qrCodeUrl: row.qr_code_url || row.qrCodeUrl || '',
      startTime: row.start_time || row.startTime,
      endTime: row.end_time || row.endTime,
      type: row.type,
      color: row.color,
      createdAt: row.created_at || row.createdAt,
    }));
  },

  async saveEvent(event: AppEvent): Promise<void> {
    const payload = {
      id: event.id,
      name: event.name,
      description: event.description || '',
      date: event.date,
      link: event.link,
      qr_code_url: event.qrCodeUrl,
      start_time: event.startTime,
      end_time: event.endTime,
      type: event.type,
      color: event.color
      // created_at is auto-generated by Supabase, do NOT include it
    };

    const { error } = await supabase.from('app_events').upsert(payload);
    if (error) console.error('Error saving event:', error);
  },

  async deleteEvent(id: string): Promise<void> {
    const { error } = await supabase.from('app_events').delete().eq('id', id);
    if (error) console.error('Error deleting event:', error);
  },

  async getInfoSettings(): Promise<AppSettings | undefined> {
    const { data, error } = await supabase.from('app_config').select('config').eq('id', 'info_point').single();
    if (error) { console.warn('Info settings not found'); return undefined; }
    return data?.config as AppSettings;
  },

  async saveInfoSettings(settings: AppSettings): Promise<void> {
    const { error } = await supabase.from('app_config').upsert({ id: 'info_point', config: settings });
    if (error) console.error('Error saving info settings:', error);
  },

  // --- IMAGES ---

  /**
   * Uploads an image file to Supabase Storage
   * @param file - The File object to upload
   * @param folder - Optional folder path within the 'images' bucket (e.g., 'groups', 'products', 'banners')
   * @returns The public URL of the uploaded image
   * @throws Error if upload fails
   */
  async uploadImage(file: File, folder: string = ''): Promise<string> {
    try {
      // Generate unique filename: timestamp + random string + original extension
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 10);
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const uniqueFileName = `${timestamp}_${randomString}.${fileExt}`;

      // Build full path with optional folder
      const filePath = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('[uploadImage] Upload failed:', uploadError);
        throw new Error(`Error al subir imagen: ${uploadError.message}`);
      }

      // Get public URL
      const { data } = supabase.storage.from('images').getPublicUrl(filePath);

      if (!data?.publicUrl) {
        throw new Error('No se pudo obtener la URL pública de la imagen');
      }

      console.log('[uploadImage] Success:', data.publicUrl);
      return data.publicUrl;
    } catch (error) {
      console.error('[uploadImage] Error:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Error desconocido al subir imagen');
    }
  },

  /**
   * Uploads a base64 encoded image to Supabase Storage
   * @param base64 - Base64 data URL string
   * @param folder - Optional folder path within the 'images' bucket
   * @returns The public URL of the uploaded image
   * @throws Error if upload fails
   */
  async uploadBase64Image(base64: string, folder: string = ''): Promise<string> {
    try {
      const fetchResponse = await fetch(base64);
      const blob = await fetchResponse.blob();

      // Determine file extension from MIME type
      const mimeType = blob.type || 'image/png';
      const ext = mimeType.split('/')[1] || 'png';

      // Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 10);
      const fileName = `${timestamp}_${randomString}.${ext}`;

      // Build full path with optional folder
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, blob, {
          contentType: mimeType,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('[uploadBase64Image] Upload failed:', uploadError);
        throw new Error(`Error al subir imagen: ${uploadError.message}`);
      }

      const { data } = supabase.storage.from('images').getPublicUrl(filePath);

      if (!data?.publicUrl) {
        throw new Error('No se pudo obtener la URL pública de la imagen');
      }

      console.log('[uploadBase64Image] Success:', data.publicUrl);
      return data.publicUrl;
    } catch (error) {
      console.error('[uploadBase64Image] Error:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Error desconocido al subir imagen');
    }
  },

  // ============================================
  // NOTIFICATIONS - Fetch from Supabase DB
  // ============================================

  /**
   * Get notifications for the current user from Supabase
   */
  async getNotifications(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[Notifications] Error fetching:', error);
        return [];
      }

      // Transform DB rows to SystemNotification format
      return (data || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        details: row.details,
        timestamp: row.created_at,
        read: row.read || false,
        targetRoles: row.target_roles || [],
        type: row.type || 'SYSTEM',
        metadata: row.metadata || {}
      }));
    } catch (error) {
      console.error('[Notifications] Exception:', error);
      return [];
    }
  },

  /**
   * Mark a single notification as read
   */
  async markNotificationAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('[Notifications] Error marking as read:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('[Notifications] Exception:', error);
      return false;
    }
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        console.error('[Notifications] Error marking all as read:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('[Notifications] Exception:', error);
      return false;
    }
  },
  // --- USER MANAGEMENT FOR GROUP CREATION ---

  /**
   * Fetch all users who are eligible to host a group (not Admins).
   * Used for Admin Group Assignment dropdown.
   */
  async getPotentialHosts(): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('[User Mgmt] Error fetching potential hosts:', error);
        return [];
      }

      const excludedRoles = ['SUPER_ADMIN', 'ADMIN_PUNTO', 'ADMIN_GROUPS', 'ADMIN_STORE', 'ADMIN_ALABANZA', 'PASTOR'];

      const users = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name || 'Usuario',
        email: row.email || '',
        role: row.role as UserRole,
        isActive: true
      }));

      // Filter out admins, but keep everyone else (including null roles, 'USER', 'VIEWER', etc.)
      return users.filter((u: User) => !excludedRoles.includes(u.role as string));
    } catch (error) {
      console.error('[User Mgmt] Exception fetching potential hosts:', error);
      return [];
    }
  },

  /**
   * Search potential hosts using server-side RPC for performance
   */
  async searchPotentialHosts(term: string): Promise<User[]> {
    try {
      const { data, error } = await supabase.rpc('search_potential_hosts', { search_term: term });
      if (error) {
        console.error('[User Mgmt] Error searching hosts:', error);
        return [];
      }
      return (data || []).map((row: any) => ({
        id: row.id,
        name: row.name || 'Usuario',
        email: row.email || '',
        role: row.role as UserRole,
        isActive: true
      }));
    } catch (error) {
      console.error('[User Mgmt] Exception searching hosts:', error);
      return [];
    }
  },

  /**
   * Get user by email for Admin Member Addition
   * Uses the search RPC which bypasses RLS
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      if (!email) return null;

      // Use the search RPC which bypasses RLS restrictions
      const users = await this.searchPotentialHosts(email);

      // Find exact email match
      const exactMatch = users.find(u => u.email.toLowerCase() === email.toLowerCase());

      return exactMatch || null;
    } catch (error) {
      console.error('[User Mgmt] Exception fetching user by email:', error);
      return null;
    }
  },

  /**
   * Admin manually adds a member to a group
   */
  async adminAddMemberToGroup(data: {
    groupId: string,
    userId: string | null,
    firstName: string,
    lastName: string,
    email: string,
    phone: string,
    // Partner data for couples groups
    partnerData?: {
      firstName: string,
      lastName: string,
      email: string,
      phone: string
    },
    partnerUserId?: string | null
  }): Promise<boolean> {
    try {
      const { groupId, userId, firstName, lastName, email, phone, partnerData, partnerUserId } = data;

      const insertData: any = {
        group_id: groupId,
        user_id: userId, // Can be null if user doesn't exist yet
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone,
        status: 'PENDING', // Insert as PENDING first
        dni: ''
      };

      // Include partner data if provided (couples registration)
      if (partnerData) {
        insertData.partner_data = partnerData;
        insertData.partner_user_id = partnerUserId || null;
      }

      // Step 1: Insert as PENDING
      const { data: insertedData, error: insertError } = await supabase
        .from('group_registrations')
        .insert(insertData)
        .select('id')
        .single();

      if (insertError || !insertedData) {
        console.error('[Admin Add Member] Error adding member:', insertError);
        return false;
      }

      // Step 2: Update to APPROVED to trigger email notification
      const { error: updateError } = await supabase
        .from('group_registrations')
        .update({ status: 'APPROVED' })
        .eq('id', insertedData.id);

      if (updateError) {
        console.error('[Admin Add Member] Error updating status:', updateError);
        return false;
      }

      console.log('[Admin Add Member] Member added and approved, email notification triggered');
      return true;
    } catch (error) {
      console.error('[Admin Add Member] Exception adding member:', error);
      return false;
    }
  },

  /**
  /**
   * Search ANY user in the system (for Host/Co-host assignment)
   */
  async searchUsersGlobal(term: string): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('name', `%${term}%`)
        .limit(20);

      if (error) {
        console.error('[User Search] Error:', error);
        return [];
      }

      return (data || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role as UserRole,
        roles: (u.roles || [u.role]) as UserRole[],
        isActive: u.is_active,
        linkedGroupId: u.linked_group_id,
        volunteerRoles: u.volunteer_roles || []
      }));
    } catch (error) {
      console.error('[User Search] Exception:', error);
      return [];
    }
  },

  /**
   * Get all users with a specific role
   */
  async getUsersByRole(role: UserRole): Promise<User[]> {
    try {
      // Fetch all users and use our robust mapping logic.
      // This prevents Postgres 'invalid input value for enum' errors 
      // when querying new roles (like COORDINATOR) against the legacy role column.
      const allUsers = await this.getAllUsers();
      return allUsers.filter(u => u.roles.includes(role) || u.role === role);
    } catch (error) {
      console.error(`[User Mgmt] Exception fetching ${role}:`, error);
      return [];
    }
  },

  /**
   * Toggle a specific role for a user
   * If 'assign' is true, sets the role.
   * If 'assign' is false, sets role to 'USUARIO' (fallback).
   */
  async toggleUserRole(userId: string, roleToAssign: UserRole, assign: boolean): Promise<boolean> {
    try {
      // Usar la nueva RPC para bypasear RLS si el usuario es Admin
      const { data, error } = await supabase.rpc('admin_toggle_user_role', {
        target_user_id: userId,
        role_to_assign: roleToAssign as string,
        assign: assign
      });

      if (error) {
        console.error('[User Mgmt] Error from RPC changing role:', JSON.stringify(error, null, 2), error.message);
        return false;
      }

      // Asegurar que devuelve True explícitamente cuando data es True
      return data === true;
    } catch (error) {
      console.error('[User Mgmt] Exception updating role via RPC:', error);
      return false;
    }
  },

  async promoteUserToHost(userId: string): Promise<boolean> {
    return this.toggleUserRole(userId, UserRole.ANFITRION, true);
  },

  // --- ATTENDANCE SYSTEM ---

  /**
   * Save or update attendance for a group on a specific date
   */
  async saveAttendance(groupId: string, date: string, presentIds: string[]): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('group_attendance')
        .upsert({
          group_id: groupId,
          date: date,
          present_members: presentIds
        }, {
          onConflict: 'group_id,date'
        });

      if (error) {
        console.error('[Attendance] Error saving attendance:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('[Attendance] Exception saving attendance:', error);
      return false;
    }
  },

  /**
   * Get attendance history for a group
   */
  async getAttendanceHistory(groupId: string): Promise<{ id: string; date: string; count: number; presentMembers: string[] }[]> {
    try {
      const { data, error } = await supabase
        .from('group_attendance')
        .select('id, date, present_members')
        .eq('group_id', groupId)
        .order('date', { ascending: false });

      if (error) {
        console.error('[Attendance] Error getting history:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        date: row.date,
        count: Array.isArray(row.present_members) ? row.present_members.length : 0,
        presentMembers: row.present_members || []
      }));
    } catch (error) {
      console.error('[Attendance] Exception getting history:', error);
      return [];
    }
  },

  /**
   * Resend group confirmation emails to selected registrations
   * Invokes the send-gcx-welcome Edge Function directly
   */
  async resendGroupConfirmationEmails(registrationIds: string[]): Promise<{ success: boolean; message: string; sent?: number; failed?: number }> {
    try {
      const { data, error } = await supabase.functions.invoke('send-gcx-welcome', {
        body: { registration_ids: registrationIds }
      });

      if (error) {
        console.error('[Email Resend] Error invoking function:', error);
        return { success: false, message: error.message || 'Error al enviar correos' };
      }

      return {
        success: true,
        message: data?.message || `${registrationIds.length} correos enviados`,
        sent: data?.sent || 0,
        failed: data?.failed || 0
      };
    } catch (error) {
      console.error('[Email Resend] Exception:', error);
      return { success: false, message: 'Error de conexión al servicio de email' };
    }
  },

  // --- DROPOUT REQUESTS (Sistema de Bajas) ---

  /**
   * Create a new dropout request (Host action)
   */
  async createDropoutRequest(request: Omit<DropoutRequest, 'id' | 'createdAt' | 'groupName' | 'hostName'> & { targetUserName?: string }): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('group_dropout_requests')
        .insert({
          group_id: request.groupId,
          host_id: request.hostId,
          request_type: request.requestType,
          target_registration_id: request.targetRegistrationId || null,
          target_user_name: request.targetUserName || null,
          reason: request.reason,
          details: request.details || null,
          status: request.status || 'PENDING'
        });

      if (error) {
        console.error('[DropoutRequest] Error creating request:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('[DropoutRequest] Exception creating request:', error);
      return false;
    }
  },

  /**
   * Get dropout requests with optional status filter
   */
  async getDropoutRequests(status?: 'PENDING' | 'APPROVED' | 'REJECTED'): Promise<DropoutRequest[]> {
    try {
      let query = supabase
        .from('group_dropout_requests')
        .select(`
          *,
          groups:group_id (name),
          hosts:host_id (name)
        `)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[DropoutRequest] Error fetching requests:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        groupId: row.group_id,
        hostId: row.host_id,
        requestType: row.request_type,
        targetUserId: row.target_user_id,
        targetRegistrationId: row.target_registration_id,
        reason: row.reason,
        details: row.details,
        status: row.status,
        createdAt: row.created_at,
        groupName: row.groups?.name || 'Grupo desconocido',
        hostName: row.hosts?.name || 'Anfitrión desconocido',
        targetUserName: row.target_user_name || null
      }));
    } catch (error) {
      console.error('[DropoutRequest] Exception fetching requests:', error);
      return [];
    }
  },

  /**
   * Update dropout request status (Admin action)
   */
  async updateDropoutRequestStatus(id: string, status: 'APPROVED' | 'REJECTED'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('group_dropout_requests')
        .update({ status })
        .eq('id', id);

      if (error) {
        console.error('[DropoutRequest] Error updating status:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('[DropoutRequest] Exception updating status:', error);
      return false;
    }
  },

  /**
   * Count pending dropout requests (for badge)
   */
  async countPendingDropoutRequests(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('group_dropout_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING');

      if (error) {
        console.error('[DropoutRequest] Error counting requests:', error);
        return 0;
      }
      return count || 0;
    } catch (error) {
      console.error('[DropoutRequest] Exception counting requests:', error);
      return 0;
    }
  },

  // --- GLOBAL REPORTS (Pastores Dashboard) ---

  /**
   * Get global attendance report for all approved groups
   * Returns each group with its latest attendance record and member lists
   */
  async getGlobalAttendanceReport(): Promise<{
    groupId: string;
    groupName: string;
    latestDate: string | null;
    presentMembers: { id: string; name: string }[];
    absentMembers: { id: string; name: string }[];
    allMembers: { id: string; name: string }[];
    status: string;
    endDate: string | null;
    leaderName: string;
  }[]> {
    try {
      // 1. Fetch all approved groups with their registrations
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select(`
          id,
          name,
          status,
          end_date,
          leader_name,
          leader_surname,
          group_registrations (
            id,
            first_name,
            last_name,
            user_id,
            status
          )
        `)
        .in('status', ['approved', 'finished']);

      if (groupsError) {
        console.error('[GlobalAttendance] Error fetching groups:', groupsError);
        return [];
      }

      // 2. For each group, fetch the latest attendance record
      const results = await Promise.all((groups || []).map(async (group: any) => {
        // Get approved members only
        const approvedRegs = (group.group_registrations || []).filter((r: any) => r.status === 'APPROVED');
        const allMembers = approvedRegs.map((r: any) => ({
          id: r.id,
          name: `${r.first_name} ${r.last_name}`
        }));

        // Fetch latest attendance
        const { data: attendance } = await supabase
          .from('group_attendance')
          .select('date, present_members')
          .eq('group_id', group.id)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!attendance) {
          return {
            groupId: group.id,
            groupName: group.name,
            latestDate: null,
            presentMembers: [],
            absentMembers: [],
            allMembers,
            status: group.status,
            endDate: group.end_date,
            leaderName: `${group.leader_name || ''} ${group.leader_surname || ''}`.trim()
          };
        }

        const presentIds = attendance.present_members || [];
        const presentMembers = allMembers.filter((m: any) => presentIds.includes(m.id));
        const absentMembers = allMembers.filter((m: any) => !presentIds.includes(m.id));

        return {
          groupId: group.id,
          groupName: group.name,
          latestDate: attendance.date,
          presentMembers,
          absentMembers,
          allMembers,
          status: group.status,
          endDate: group.end_date,
          leaderName: `${group.leader_name || ''} ${group.leader_surname || ''}`.trim()
        };
      }));

      return results;
    } catch (error) {
      console.error('[GlobalAttendance] Exception:', error);
      return [];
    }
  },

  async getFullAttendanceReport(): Promise<{
    groupId: string;
    groupName: string;
    leaderName: string;
    meetingDay: string;
    meetingTime: string;
    startDate: string | null;
    endDate: string | null;
    status: string;
    allMembers: { id: string; name: string }[];
    attendanceRecords: {
      date: string;
      presentMembers: { id: string; name: string }[];
      absentMembers: { id: string; name: string }[];
      totalPresent: number;
      totalAbsent: number;
    }[];
  }[]> {
    try {
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select(`
          id,
          name,
          status,
          start_date,
          end_date,
          leader_name,
          leader_surname,
          meeting_day,
          meeting_time,
          group_registrations (
            id,
            first_name,
            last_name,
            status
          )
        `)
        .in('status', ['approved', 'finished']);

      if (groupsError) {
        console.error('[FullAttendance] Error fetching groups:', groupsError);
        return [];
      }

      const results = await Promise.all(
        (groups || []).map(async (group: any) => {
          const approvedRegs = (group.group_registrations || [])
            .filter((r: any) => r.status === 'APPROVED');
          const allMembers = approvedRegs.map((r: any) => ({
            id: r.id,
            name: `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Sin nombre'
          }));

          const { data: attendance, error: attError } = await supabase
            .from('group_attendance')
            .select('id, date, present_members')
            .eq('group_id', group.id)
            .order('date', { ascending: false });

          if (attError) {
            console.error(
              `[FullAttendance] Error fetching attendance for ${group.id}:`,
              attError
            );
          }

          const attendanceRecords = (attendance || []).map((rec: any) => {
            const presentIds: string[] = Array.isArray(rec.present_members)
              ? rec.present_members
              : [];
            const presentMembers = allMembers.filter(m => presentIds.includes(m.id));
            const absentMembers = allMembers.filter(m => !presentIds.includes(m.id));
            return {
              date: rec.date,
              presentMembers,
              absentMembers,
              totalPresent: presentMembers.length,
              totalAbsent: absentMembers.length,
            };
          });

          return {
            groupId: group.id,
            groupName: group.name,
            leaderName: `${group.leader_name || ''} ${group.leader_surname || ''}`.trim(),
            meetingDay: group.meeting_day || 'Lunes',
            meetingTime: group.meeting_time || '',
            startDate: group.start_date || null,
            endDate: group.end_date || null,
            status: group.status,
            allMembers,
            attendanceRecords,
          };
        })
      );

      return results;
    } catch (error) {
      console.error('[FullAttendance] Exception:', error);
      return [];
    }
  },

  /**
   * Get all dropout requests with full join data for reporting
   */
  async getAllDropoutRequests(): Promise<DropoutRequest[]> {
    try {
      const { data, error } = await supabase
        .from('group_dropout_requests')
        .select(`
          *,
          groups:group_id (name),
          hosts:host_id (name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[DropoutRequest] Error fetching all requests:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        groupId: row.group_id,
        hostId: row.host_id,
        requestType: row.request_type,
        targetUserId: row.target_user_id,
        targetRegistrationId: row.target_registration_id,
        reason: row.reason,
        details: row.details,
        status: row.status,
        createdAt: row.created_at,
        groupName: row.groups?.name || 'Grupo desconocido',
        hostName: row.hosts?.name || 'Anfitrión desconocido',
        targetUserName: row.target_user_name || null
      }));
    } catch (error) {
      console.error('[DropoutRequest] Exception fetching all:', error);
      return [];
    }
  },

  /**
   * Check if the current user has a pending or approved application
   * This is a secure method that only returns the user's OWN application
   */
  async getUserLeaderApplication(userId?: string, email?: string): Promise<LeaderApplication | null> {
    try {
      if (!userId && !email) return null;

      let query = supabase
        .from('leader_applications')
        .select('*')
        .limit(1);

      if (userId) {
        query = query.eq('applicant_id', userId);
      } else if (email) {
        query = query.eq('email', email);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('[LeaderApps] Error checking user application:', error);
        return null;
      }

      if (!data) return null;

      return {
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email,
        phone: data.phone,
        completedLeaderCourse: data.completed_leader_course,
        completedHicisteCrecer: data.completed_hiciste_crecer,
        completedVolunteerTraining: data.completed_volunteer_training,
        attendsOrigen: data.attends_origen,
        applicantId: data.applicant_id,
        status: data.status,
        createdAt: data.created_at
      };
    } catch (error) {
      console.error('[LeaderApps] Exception checking user application:', error);
      return null;
    }
  },

  // ============================================
  // PASTORAL CARE – service_statistics table
  // ============================================

  async getServiceStatistics(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('service_statistics')
        .select('*')
        .order('service_date', { ascending: false });

      if (error) {
        console.error('[PastoralCare] Error fetching statistics:', error);
        return [];
      }
      return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        service_date: row.service_date,
        service_time: row.service_time ?? null,
        conecta: row.vol_conecta,
        store: row.vol_store,
        host_prevencion: row.vol_host_prevencion,
        punto_info: row.vol_info_point,
        produccion: row.vol_produccion,
        equipo_ministracion: row.vol_ministracion,
        atmosfera: row.vol_atmosfera,
        visuales: row.vol_visuales,
        redes: row.vol_redes,
        sala_bienvenida: row.vol_bienvenida,
        sonido: row.vol_sonido,
        ea: row.vol_ea,
        streaming: row.vol_streaming,
        camaras: row.vol_camaras,
        fotos: row.vol_fotos,
        profes_ninez: row.vol_profes_ninez,
        auditorio: row.auditorio,
        ninos_3_6: row.kids_3_6,
        ninos_7_10: row.kids_7_10,
        ninos_hd: row.kids_hd,
        borders: row.kids_borders,
        online: row.other_online,
        voluntarios_repetidos: row.other_repeated_vol,
        aceptaron: row.other_accepted,
        asistieron_primera_vez: row.other_first_time,
        reconciliaron: row.other_reconciled,
        podcast: row.other_podcast,
        oracion: row.other_prayer,
        conference_sessions: row.conference_sessions || [],
        // New columns (2026-03-29)
        service_hour: row.service_hour || null,
        observations: row.observations || null,
        category: row.category || null,
        service_type: row.service_type || null
      }));
    } catch (error) {
      console.error('[PastoralCare] Exception fetching statistics:', error);
      return [];
    }
  },

  async upsertServiceStatistic(record: any): Promise<{ data: any | null; error: string | null }> {
    try {
      const payload: any = {
        name: record.name || null,
        service_date: record.service_date,
        service_time: record.service_time ?? null,
        vol_conecta: record.conecta ?? 0,
        vol_store: record.store ?? 0,
        vol_host_prevencion: record.host_prevencion ?? 0,
        vol_info_point: record.punto_info ?? 0,
        vol_produccion: record.produccion ?? 0,
        vol_ministracion: record.equipo_ministracion ?? 0,
        vol_atmosfera: record.atmosfera ?? 0,
        vol_visuales: record.visuales ?? 0,
        vol_redes: record.redes ?? 0,
        vol_bienvenida: record.sala_bienvenida ?? 0,
        vol_sonido: record.sonido ?? 0,
        vol_ea: record.ea ?? 0,
        vol_streaming: record.streaming ?? 0,
        vol_camaras: record.camaras ?? 0,
        vol_fotos: record.fotos ?? 0,
        vol_profes_ninez: record.profes_ninez ?? 0,
        auditorio: record.auditorio ?? 0,
        kids_3_6: record.ninos_3_6 ?? 0,
        kids_7_10: record.ninos_7_10 ?? 0,
        kids_hd: record.ninos_hd ?? 0,
        kids_borders: record.borders ?? 0,
        other_online: record.online ?? 0,
        other_repeated_vol: record.voluntarios_repetidos ?? 0,
        other_accepted: record.aceptaron ?? 0,
        other_first_time: record.asistieron_primera_vez ?? 0,
        other_reconciled: record.reconciliaron ?? 0,
        other_podcast: record.podcast ?? 0,
        other_prayer: record.oracion ?? 0,
        conference_sessions: record.conference_sessions || [],
        // New columns (2026-03-29)
        service_hour: record.service_hour || null,
        observations: record.observations || null,
        category: record.category || null,
        service_type: record.service_type || null
      };

      if (record.id) {
        payload.id = record.id;
      }

      const { data, error } = await supabase
        .from('service_statistics')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        console.error('[PastoralCare] Error upserting statistic:', error);
        return { data: null, error: error.message };
      }
      return { data, error: null };
    } catch (error: any) {
      console.error('[PastoralCare] Exception upserting statistic:', error);
      return { data: null, error: error?.message || 'Unknown error' };
    }
  },

  async deleteServiceStatistic(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('service_statistics')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[PastoralCare] Error deleting statistic:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('[PastoralCare] Exception deleting statistic:', error);
      return false;
    }
  },

  /**
   * Finds a comparable record from the same month in a previous year.
   * Tries previous year first, then year before that.
   */
  async getYoYRecord(serviceDate: string, currentId: string): Promise<any | null> {
    try {
      const d = new Date(serviceDate);
      const month = d.getMonth() + 1; // 1-12
      const currentYear = d.getFullYear();

      for (const yearOffset of [1, 2]) {
        const targetYear = currentYear - yearOffset;

        // Build date range for target month in target year
        const monthStr = String(month).padStart(2, '0');
        const rangeStart = `${targetYear}-${monthStr}-01`;
        const lastDay = new Date(targetYear, month, 0).getDate();
        const rangeEnd = `${targetYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

        const { data, error } = await supabase
          .from('service_statistics')
          .select('*')
          .neq('id', currentId)
          .gte('service_date', rangeStart)
          .lte('service_date', rangeEnd)
          .order('service_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('[PastoralCare] Error fetching YoY record:', error);
          continue;
        }

        if (data) {
          return {
            id: data.id,
            name: data.name,
            service_date: data.service_date,
            service_time: data.service_time ?? null,
            conecta: data.vol_conecta,
            store: data.vol_store,
            host_prevencion: data.vol_host_prevencion,
            punto_info: data.vol_info_point,
            produccion: data.vol_produccion,
            equipo_ministracion: data.vol_ministracion,
            atmosfera: data.vol_atmosfera,
            visuales: data.vol_visuales,
            redes: data.vol_redes,
            sala_bienvenida: data.vol_bienvenida,
            sonido: data.vol_sonido,
            ea: data.vol_ea,
            streaming: data.vol_streaming,
            camaras: data.vol_camaras,
            fotos: data.vol_fotos,
            profes_ninez: data.vol_profes_ninez,
            auditorio: data.auditorio,
            ninos_3_6: data.kids_3_6,
            ninos_7_10: data.kids_7_10,
            ninos_hd: data.kids_hd,
            borders: data.kids_borders,
            online: data.other_online,
            voluntarios_repetidos: data.other_repeated_vol,
            aceptaron: data.other_accepted,
            asistieron_primera_vez: data.other_first_time,
            reconciliaron: data.other_reconciled,
            podcast: data.other_podcast,
            oracion: data.other_prayer
          };
        }
      }

      return null;
    } catch (error) {
      console.error('[PastoralCare] Exception fetching YoY record:', error);
      return null;
    }
  },

  // --- METRICS (GROUPS) ---
  async getGroupRegistrationAnalytics(
    filter: 'ACTIVOS' | 'FINALIZADOS' | 'ALL' | 'S1' | 'S2' | 'S3' = 'ALL'
  ): Promise<{
    totalGroups: number;
    totalHosts: number;
    totalCoHosts: number;
    totalRegistrations: number;
    uniquePeople: number;
    distribution: Record<string, number>;
  } | null> {
    try {
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('id, status, start_date, end_date, host_id, co_host_id');

      if (groupsError) {
        console.error('[supabaseService] Error fetching groups for analytics:', groupsError);
        return null;
      }

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      let validGroups = groups || [];

      if (filter !== 'ALL') {
        validGroups = validGroups.filter((g: any) => {
          const isFinished = g.status === 'finished' ||
              (g.end_date && g.end_date < todayStr);

          if (filter === 'ACTIVOS') {
              return g.status === 'approved' && !isFinished;
          } else if (filter === 'FINALIZADOS') {
              return isFinished;
          } else {
              // Filtro de temporada: S1, S2 o S3
              // Solo grupos aprobados cuyo start_date
              // cae en la temporada seleccionada
              const season = getSeasonFromDate(g.start_date);
              return g.status === 'approved' &&
                     season === filter;
          }
        });
      }

      const validGroupIds = new Set(validGroups.map(g => g.id));
      const totalGroups = validGroups.length;

      const hostSet = new Set<string>();
      const coHostSet = new Set<string>();
      validGroups.forEach(g => {
        if (g.host_id) hostSet.add(g.host_id);
        if (g.co_host_id) coHostSet.add(g.co_host_id);
      });
      const totalHosts = hostSet.size;
      const totalCoHosts = coHostSet.size;

      if (validGroupIds.size === 0) {
        return { totalGroups, totalHosts, totalCoHosts, totalRegistrations: 0, uniquePeople: 0, distribution: { '1': 0, '2': 0, '3+': 0 } };
      }

      const { data: registrations, error: regError } = await supabase
        .from('group_registrations')
        .select('user_id, email, group_id, partner_data, partner_user_id')
        .in('group_id', Array.from(validGroupIds));

      if (regError) {
        console.error('[supabaseService] Error fetching group registrations:', regError);
        return null;
      }

      const filteredRegs = registrations || [];

      let totalRegistrations = 0;
      const userCounts: Record<string, number> = {};

      filteredRegs.forEach(row => {
        // Base registration
        totalRegistrations += 1;
        const mainId = row.user_id || row.email || `reg-${Math.random()}`;
        userCounts[mainId] = (userCounts[mainId] || 0) + 1;

        // Partner registration
        if (row.partner_data) {
          totalRegistrations += 1;
          const pd = row.partner_data as any; // JSONB
          const partnerId = row.partner_user_id || pd?.email || pd?.firstName + pd?.lastName || `partner-${Math.random()}`;
          userCounts[partnerId] = (userCounts[partnerId] || 0) + 1;
        }
      });

      const uniquePeople = Object.keys(userCounts).length;
      const distribution: Record<string, number> = {
        '1': 0,
        '2': 0,
        '3+': 0
      };

      Object.values(userCounts).forEach(count => {
        if (count === 1) distribution['1'] += 1;
        else if (count === 2) distribution['2'] += 2;
        else if (count >= 3) distribution['3+'] += count;
      });

      return { totalGroups, totalHosts, totalCoHosts, totalRegistrations, uniquePeople, distribution };
    } catch (err) {
      console.error('[supabaseService] Exception calculating group registration analytics:', err);
      return null;
    }
  },

  // --- ANNOUNCEMENTS (SUPABASE) ---

  async getAnnouncements(): Promise<import('../types').Announcement[]> {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[supabaseService] Error fetching announcements:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description || '',
      startDate: row.start_date,
      endDate: row.end_date,
      isActive: row.is_active,
      isPermanent: row.is_permanent,
      link: row.link,
      qrCodeUrl: row.qr_code_url,
      createdAt: row.created_at,
    }));
  },

  async saveAnnouncement(announcement: import('../types').Announcement): Promise<void> {
    const payload = {
      id: announcement.id,
      title: announcement.title,
      description: announcement.description || '',
      start_date: announcement.startDate,
      end_date: announcement.endDate,
      is_active: announcement.isActive ?? true,
      is_permanent: announcement.isPermanent ?? false,
      link: announcement.link,
      qr_code_url: announcement.qrCodeUrl,
      created_at: announcement.createdAt,
    };

    const { error } = await supabase
      .from('announcements')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error('[supabaseService] Error saving announcement:', error);
      throw error;
    }
  },

  async deleteAnnouncement(id: string): Promise<void> {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[supabaseService] Error deleting announcement:', error);
      throw error;
    }
  },
};
