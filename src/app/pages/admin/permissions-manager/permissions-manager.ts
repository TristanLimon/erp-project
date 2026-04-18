import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { AvatarModule } from 'primeng/avatar';
import { MessageService } from 'primeng/api';
import { PermissionService, AppUser, Permission, ALL_PERMISSIONS, Group } from '../../../services/permission.service';
import { HasPermissionDirective } from '../../../directives/has-permission.directive';

// ── Agrupaciones visuales ──────────────────────────────────────────────────────
const PERM_GROUPS = [
  {
    label: 'Tickets', icon: 'pi-ticket', color: '#6c47ff',
    bg: '#f3f0ff', border: '#ddd6fe',
    perms: ALL_PERMISSIONS.filter(p => p.startsWith('ticket:')),
  },
  {
    label: 'Grupos', icon: 'pi-folder-open', color: '#0ea5e9',
    bg: '#f0f9ff', border: '#bae6fd',
    perms: ALL_PERMISSIONS.filter(p => p.startsWith('group:')),
  },
  {
    label: 'Usuarios', icon: 'pi-user-edit', color: '#f59e0b',
    bg: '#fffbeb', border: '#fde68a',
    perms: ALL_PERMISSIONS.filter(p => p.startsWith('user:')),
  },
];

const PERM_LABELS: Record<string, string> = {
  'ticket:create': 'Crear tickets', 'ticket:edit': 'Editar tickets',
  'ticket:delete': 'Eliminar tickets', 'ticket:view': 'Ver tickets',
  'ticket:assign': 'Asignar tickets', 'ticket:change_status': 'Cambiar estado',
  'ticket:comment': 'Comentar',
  'group:create': 'Crear grupos', 'group:edit': 'Editar grupos',
  'group:delete': 'Eliminar grupos', 'group:view': 'Ver grupos',
  'group:add_member': 'Agregar miembros', 'group:remove_member': 'Quitar miembros',
  'user:create': 'Crear usuarios', 'user:edit': 'Editar usuarios',
  'user:delete': 'Eliminar usuarios', 'user:view': 'Ver usuarios',
  'user:manage_permissions': 'Gestionar permisos',
};

const AVATAR_COLORS = ['#6c47ff','#0ea5e9','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#14b8a6'];

interface GroupMembership {
  groupId: string;
  groupName: string;
  groupColor: string;
  permissions: Permission[];
}

@Component({
  selector: 'app-permissions-manager',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, InputTextModule, ToastModule, DividerModule,
    TooltipModule, IconFieldModule, InputIconModule, AvatarModule,
    HasPermissionDirective,
  ],
  providers: [MessageService],
  template: `
<p-toast position="top-right" />

<div *hasPermission="'user:manage_permissions'; else noPerm">
  <div class="pm-shell">

    <!-- ── Sidebar: lista de usuarios ─────────────────────── -->
    <aside class="user-panel">
      <div class="user-panel-header">
        <span class="up-title"><i class="pi pi-users"></i> Usuarios</span>
        <p-iconfield>
          <p-inputicon class="pi pi-search" />
          <input pInputText [(ngModel)]="search" placeholder="Buscar..." />
        </p-iconfield>
      </div>

      <div class="user-list">
        @for (u of filteredUsers(); track u.id) {
          <div class="user-item" [class.selected]="selectedUser()?.id === u.id"
               (click)="selectUser(u)">
            <div class="ui-avatar" [style]="{'background': avatarColor(u.id)}">
              {{ u.nombreCompleto.charAt(0).toUpperCase() }}
            </div>
            <div class="ui-info">
              <span class="ui-name">{{ u.nombreCompleto }}</span>
              <span class="ui-sub">@{{ u.usuario }}</span>
            </div>
            <div class="ui-counts">
              <span class="badge-global" pTooltip="Permisos globales">{{ u.permissions.length }}</span>
            </div>
          </div>
        }
        @if (filteredUsers().length === 0) {
          <p class="no-results">Sin resultados</p>
        }
      </div>
    </aside>

    <!-- ── Panel de permisos ──────────────────────────────── -->
    <main class="perms-panel">

      @if (!selectedUser()) {
        <div class="empty-select">
          <div class="empty-ico"><i class="pi pi-hand-pointer"></i></div>
          <p>Selecciona un usuario para gestionar sus permisos</p>
        </div>
      } @else {

        <!-- Header del usuario seleccionado -->
        <div class="selected-header">
          <div class="sh-avatar" [style]="{'background': avatarColor(selectedUser()!.id)}">
            {{ selectedUser()!.nombreCompleto.charAt(0).toUpperCase() }}
          </div>
          <div>
            <h2 class="sh-name">{{ selectedUser()!.nombreCompleto }}</h2>
            <span class="sh-sub">@{{ selectedUser()!.usuario }} · {{ selectedUser()!.email }}</span>
          </div>
          <div class="sh-summary">
            <div class="summary-pill pill-global">
              <i class="pi pi-globe"></i>
              <span>{{ countGlobal() }} globales</span>
            </div>
            <div class="summary-pill pill-group">
              <i class="pi pi-users"></i>
              <span>{{ memberships().length }} grupos</span>
            </div>
          </div>
        </div>

        <!-- ════════════════════════════════════════════════════
             SECCIÓN 1: Permisos Globales
             ════════════════════════════════════════════════════ -->
        <div class="section-card">
          <div class="section-head">
            <div class="section-title-row">
              <div class="section-icon global-icon"><i class="pi pi-globe"></i></div>
              <div>
                <span class="section-title">Permisos Globales</span>
                <span class="section-desc">Aplican en toda la aplicación, sin importar el grupo activo</span>
              </div>
            </div>
            <div class="section-actions">
              <p-button label="Todos" size="small" variant="outlined" icon="pi pi-check-square"
                        (onClick)="setAllGlobal(true)" />
              <p-button label="Ninguno" size="small" variant="outlined" severity="secondary"
                        icon="pi pi-stop" (onClick)="setAllGlobal(false)" />
              <p-button label="Guardar" size="small" icon="pi pi-save" severity="success"
                        [disabled]="!globalDirty()" (onClick)="saveGlobal()"
                        [loading]="savingGlobal()" />
            </div>
          </div>

          @if (savedGlobal()) {
            <div class="save-ok"><i class="pi pi-check-circle"></i> Permisos globales guardados</div>
          }

          <div class="perm-grid">
            @for (pg of permGroups; track pg.label) {
              <div class="perm-card" [style]="{'border-top': '3px solid ' + pg.color}">
                <div class="pc-head" [style]="{'background': pg.bg}">
                  <i [class]="'pi ' + pg.icon" [style]="{'color': pg.color}"></i>
                  <span [style]="{'color': pg.color, 'font-weight': '700'}">{{ pg.label }}</span>
                  <span class="pc-count" [style]="{'background': pg.color}">
                    {{ countInGroup(globalTemp(), pg.perms) }}/{{ pg.perms.length }}
                  </span>
                </div>
                <div class="perm-list">
                  @for (p of pg.perms; track p) {
                    <label class="perm-item" [class.active]="globalTemp()[p]"
                           (click)="toggleGlobal(p)">
                      <span class="pcheck" [class.on]="globalTemp()[p]"
                            [style]="globalTemp()[p] ? {'background':pg.color,'border-color':pg.color} : {}">
                        @if (globalTemp()[p]) { <i class="pi pi-check" style="font-size:.55rem;color:#fff"></i> }
                      </span>
                      <span class="plabel">{{ permLabels[p] || p }}</span>
                      <code class="pcode">{{ p }}</code>
                    </label>
                  }
                </div>
              </div>
            }
          </div>
        </div>

        <!-- ════════════════════════════════════════════════════
             SECCIÓN 2: Permisos por Grupo
             ════════════════════════════════════════════════════ -->
        <div class="section-card">
          <div class="section-head">
            <div class="section-title-row">
              <div class="section-icon group-icon"><i class="pi pi-folder-open"></i></div>
              <div>
                <span class="section-title">Permisos por Grupo</span>
                <span class="section-desc">Solo aplican cuando el usuario está dentro del grupo seleccionado</span>
              </div>
            </div>
          </div>

          @if (loadingMemberships()) {
            <div class="loading-state">
              <i class="pi pi-spin pi-spinner"></i> Cargando membresías...
            </div>
          } @else if (memberships().length === 0) {
            <div class="empty-memberships">
              <i class="pi pi-folder" style="font-size:2rem;color:#d1d5db"></i>
              <p>Este usuario no pertenece a ningún grupo</p>
            </div>
          } @else {
            <div class="groups-accordion">
              @for (m of memberships(); track m.groupId) {
                <div class="group-section" [class.open]="openGroupId === m.groupId">
                  <!-- Group header -->
                  <div class="gs-header" (click)="toggleGroupSection(m.groupId)"
                       [style]="{'border-left': '4px solid ' + m.groupColor}">
                    <div class="gs-left">
                      <div class="gs-dot" [style]="{'background': m.groupColor}">
                        {{ m.groupName.charAt(0) }}
                      </div>
                      <div>
                        <span class="gs-name">{{ m.groupName }}</span>
                        <span class="gs-count">
                          {{ countInGroupFromMap(groupTemps()[m.groupId] ?? {}, ALL_PERMISSIONS) }} / {{ ALL_PERMISSIONS.length }} permisos
                        </span>
                      </div>
                    </div>
                    <div class="gs-right">
                      @if (groupDirty()[m.groupId]) {
                        <p-button label="Guardar" size="small" icon="pi pi-save" severity="success"
                                  (onClick)="saveGroup(m); $event.stopPropagation()"
                                  [loading]="savingGroupId() === m.groupId" />
                      }
                      <i class="pi pi-chevron-down gs-chevron"
                         [class.rotated]="openGroupId === m.groupId"></i>
                    </div>
                  </div>

                  <!-- Permisos del grupo (expandible) -->
                  @if (openGroupId === m.groupId) {
                    <div class="gs-body">
                      <div class="gs-toolbar">
                        <p-button label="Todos" size="small" variant="outlined"
                                  icon="pi pi-check-square"
                                  (onClick)="setAllGroup(m.groupId, true)" />
                        <p-button label="Ninguno" size="small" variant="outlined"
                                  severity="secondary" icon="pi pi-stop"
                                  (onClick)="setAllGroup(m.groupId, false)" />
                        @if (savedGroupId() === m.groupId) {
                          <span class="save-ok-inline">
                            <i class="pi pi-check-circle"></i> Guardado
                          </span>
                        }
                      </div>

                      <div class="perm-grid">
                        @for (pg of permGroups; track pg.label) {
                          <div class="perm-card" [style]="{'border-top': '3px solid ' + pg.color}">
                            <div class="pc-head" [style]="{'background': pg.bg}">
                              <i [class]="'pi ' + pg.icon" [style]="{'color': pg.color}"></i>
                              <span [style]="{'color': pg.color, 'font-weight': '700'}">{{ pg.label }}</span>
                              <span class="pc-count" [style]="{'background': pg.color}">
                                {{ countInGroup(groupTemps()[m.groupId] ?? {}, pg.perms) }}/{{ pg.perms.length }}
                              </span>
                            </div>
                            <div class="perm-list">
                              @for (p of pg.perms; track p) {
                                <label class="perm-item"
                                       [class.active]="getGroupPerm(m.groupId, p)"
                                       (click)="toggleGroupPerm(m.groupId, p)">
                                  <span class="pcheck" [class.on]="getGroupPerm(m.groupId, p)"
                                        [style]="getGroupPerm(m.groupId, p) ? {'background':pg.color,'border-color':pg.color} : {}">
                                    @if (getGroupPerm(m.groupId, p)) {
                                      <i class="pi pi-check" style="font-size:.55rem;color:#fff"></i>
                                    }
                                  </span>
                                  <span class="plabel">{{ permLabels[p] || p }}</span>
                                  <code class="pcode">{{ p }}</code>
                                </label>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>

      }
    </main>
  </div>
</div>

<ng-template #noPerm>
  <div class="no-access">
    <div class="no-access-ico"><i class="pi pi-lock"></i></div>
    <h2>Acceso restringido</h2>
    <p>Necesitas el permiso <code>user:manage_permissions</code> para entrar aquí.</p>
  </div>
</ng-template>
  `,
  styles: [`
    /* ── Shell ──────────────────────────────────────────────────────── */
    .pm-shell { display:grid; grid-template-columns:280px 1fr; height:calc(100vh - 0px); }
    @media(max-width:900px) { .pm-shell { grid-template-columns:1fr; } }

    /* ── User panel (sidebar izquierdo) ─────────────────────────────── */
    .user-panel { background:#fff; border-right:1px solid #f0eff8; display:flex; flex-direction:column; height:100vh; position:sticky; top:0; overflow:hidden; }
    .user-panel-header { padding:1.25rem 1rem .75rem; display:flex; flex-direction:column; gap:.65rem; border-bottom:1px solid #f0eff8; }
    .up-title { font-weight:800; font-size:.95rem; color:#0f0a2e; display:flex; align-items:center; gap:.5rem; }
    .user-list { flex:1; overflow-y:auto; padding:.5rem; }

    .user-item { display:flex; align-items:center; gap:.75rem; padding:.75rem; border-radius:10px; cursor:pointer; transition:background .15s; border:2px solid transparent; }
    .user-item:hover { background:#f9f7ff; }
    .user-item.selected { background:#f3f0ff; border-color:#ddd6fe; }
    .ui-avatar { width:38px; height:38px; border-radius:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:1rem; font-weight:800; color:#fff; box-shadow:0 2px 6px rgba(0,0,0,.15); }
    .ui-info { flex:1; min-width:0; display:flex; flex-direction:column; }
    .ui-name { font-weight:700; font-size:.875rem; color:#0f0a2e; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ui-sub { font-size:.73rem; color:#9ca3af; }
    .ui-counts { display:flex; align-items:center; gap:.3rem; flex-shrink:0; }
    .badge-global { background:#ede9fe; color:#6c47ff; font-size:.68rem; font-weight:700; padding:.15rem .45rem; border-radius:20px; border:1px solid #ddd6fe; }
    .no-results { text-align:center; color:#9ca3af; font-size:.85rem; padding:2rem 1rem; }

    /* ── Perms panel (derecha) ──────────────────────────────────────── */
    .perms-panel { overflow-y:auto; padding:1.75rem; display:flex; flex-direction:column; gap:1.5rem; background:#f8f7ff; }

    .empty-select { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; min-height:60vh; color:#9ca3af; text-align:center; gap:.75rem; }
    .empty-ico { width:72px; height:72px; border-radius:20px; background:#ede9fe; display:flex; align-items:center; justify-content:center; font-size:2rem; color:#a78bfa; }

    /* Selected user header */
    .selected-header { display:flex; align-items:center; gap:1rem; background:#fff; padding:1.25rem 1.5rem; border-radius:16px; box-shadow:0 1px 8px rgba(0,0,0,.06); flex-wrap:wrap; }
    .sh-avatar { width:52px; height:52px; border-radius:14px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:1.3rem; font-weight:800; color:#fff; box-shadow:0 3px 10px rgba(0,0,0,.15); }
    .sh-name { font-size:1.15rem; font-weight:800; color:#0f0a2e; margin:0 0 .2rem; }
    .sh-sub { font-size:.8rem; color:#9ca3af; }
    .sh-summary { margin-left:auto; display:flex; gap:.6rem; flex-wrap:wrap; }
    .summary-pill { display:flex; align-items:center; gap:.4rem; font-size:.78rem; font-weight:700; padding:.35rem .75rem; border-radius:20px; }
    .pill-global { background:#f3f0ff; color:#6c47ff; border:1px solid #ddd6fe; }
    .pill-group { background:#f0f9ff; color:#0ea5e9; border:1px solid #bae6fd; }

    /* Section card */
    .section-card { background:#fff; border-radius:16px; box-shadow:0 1px 8px rgba(0,0,0,.06); overflow:hidden; }
    .section-head { display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:.75rem; padding:1.25rem 1.5rem; border-bottom:1px solid #f3f4f6; }
    .section-title-row { display:flex; align-items:center; gap:.85rem; }
    .section-icon { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0; }
    .global-icon { background:linear-gradient(135deg,#6c47ff,#8b5cff); color:#fff; box-shadow:0 3px 10px rgba(108,71,255,.3); }
    .group-icon { background:linear-gradient(135deg,#0ea5e9,#38bdf8); color:#fff; box-shadow:0 3px 10px rgba(14,165,233,.3); }
    .section-title { display:block; font-weight:800; font-size:1rem; color:#0f0a2e; }
    .section-desc { display:block; font-size:.78rem; color:#9ca3af; margin-top:.15rem; }
    .section-actions { display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; }

    .save-ok { display:flex; align-items:center; gap:.5rem; padding:.75rem 1.5rem; background:#f0fdf4; color:#16a34a; font-size:.875rem; font-weight:600; border-bottom:1px solid #bbf7d0; }
    .save-ok-inline { display:flex; align-items:center; gap:.35rem; color:#16a34a; font-size:.82rem; font-weight:600; }

    /* Perm grid */
    .perm-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(240px,1fr)); gap:1rem; padding:1.25rem 1.5rem; }
    .perm-card { border-radius:12px; box-shadow:0 1px 4px rgba(0,0,0,.05); overflow:hidden; background:#fff; border:1px solid #f3f4f6; }
    .pc-head { display:flex; align-items:center; gap:.5rem; padding:.65rem 1rem; font-size:.875rem; }
    .pc-count { margin-left:auto; color:#fff; font-size:.65rem; font-weight:800; padding:.15rem .5rem; border-radius:20px; font-family:monospace; }
    .perm-list { padding:.6rem .85rem; display:flex; flex-direction:column; gap:.25rem; }
    .perm-item { display:flex; align-items:center; gap:.6rem; padding:.4rem .5rem; border-radius:8px; cursor:pointer; transition:background .1s; border:1px solid transparent; }
    .perm-item:hover { background:#f9fafb; }
    .perm-item.active { background:#fafbff; border-color:#ede9fe; }
    .pcheck { width:15px; height:15px; border-radius:4px; flex-shrink:0; border:2px solid #d1d5db; display:flex; align-items:center; justify-content:center; transition:all .15s; }
    .pcheck.on { border-color:#6c47ff; }
    .plabel { font-size:.8rem; font-weight:500; color:#374151; flex:1; }
    .pcode { font-size:.6rem; color:#c4b5fd; background:#f3f0ff; padding:.1rem .4rem; border-radius:5px; font-family:monospace; }

    /* Groups accordion */
    .groups-accordion { display:flex; flex-direction:column; }
    .group-section { border-bottom:1px solid #f3f4f6; }
    .group-section:last-child { border-bottom:none; }
    .gs-header { display:flex; align-items:center; justify-content:space-between; padding:1rem 1.5rem; cursor:pointer; transition:background .12s; gap:1rem; }
    .gs-header:hover { background:#fafafa; }
    .gs-left { display:flex; align-items:center; gap:.85rem; }
    .gs-dot { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:.9rem; font-weight:800; color:#fff; flex-shrink:0; }
    .gs-name { display:block; font-weight:700; font-size:.9rem; color:#0f0a2e; }
    .gs-count { display:block; font-size:.73rem; color:#9ca3af; }
    .gs-right { display:flex; align-items:center; gap:.75rem; }
    .gs-chevron { color:#d1d5db; font-size:.8rem; transition:transform .2s; }
    .gs-chevron.rotated { transform:rotate(180deg); color:#6c47ff; }
    .gs-body { padding:1rem 1.5rem 1.5rem; background:#fafafa; }
    .gs-toolbar { display:flex; align-items:center; gap:.5rem; margin-bottom:1rem; flex-wrap:wrap; }

    .loading-state { display:flex; align-items:center; gap:.65rem; padding:2rem 1.5rem; color:#9ca3af; font-size:.9rem; }
    .empty-memberships { display:flex; flex-direction:column; align-items:center; gap:.5rem; padding:2.5rem; color:#9ca3af; }

    /* No access */
    .no-access { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:70vh; text-align:center; padding:2rem; }
    .no-access-ico { width:80px; height:80px; border-radius:24px; background:#fee2e2; display:flex; align-items:center; justify-content:center; font-size:2rem; color:#ef4444; margin-bottom:1.25rem; }
    .no-access h2 { color:#0f0a2e; font-weight:800; margin:0 0 .5rem; }
    .no-access p { color:#9ca3af; margin:0; }
    .no-access code { background:#f3f0ff; color:#6c47ff; padding:.2rem .5rem; border-radius:6px; font-size:.85rem; }
  `]
})
export class PermissionsManagerComponent implements OnInit {
  search = '';
  permGroups = PERM_GROUPS;
  permLabels = PERM_LABELS;
  ALL_PERMISSIONS = ALL_PERMISSIONS;

  // ── Estado ──────────────────────────────────────────────────────────────────
  selectedUser    = signal<AppUser | null>(null);
  memberships     = signal<GroupMembership[]>([]);
  loadingMemberships = signal(false);
  openGroupId: string | null = null;

  // Globales
  globalTemp      = signal<Record<string, boolean>>({});
  globalDirty     = signal(false);
  savingGlobal    = signal(false);
  savedGlobal     = signal(false);

  // Por grupo
  groupTemps      = signal<Record<string, Record<string, boolean>>>({});
  groupDirty      = signal<Record<string, boolean>>({});
  savingGroupId   = signal<string | null>(null);
  savedGroupId    = signal<string | null>(null);

  filteredUsers = computed(() => {
    const s = this.search.toLowerCase();
    return this.ps.users().filter(u =>
      !s || u.nombreCompleto.toLowerCase().includes(s) ||
      u.usuario.toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s)
    );
  });

  countGlobal = computed(() =>
    ALL_PERMISSIONS.filter(p => this.globalTemp()[p]).length
  );

  constructor(public ps: PermissionService, private msg: MessageService) {}

  ngOnInit() {}

  // ── Selección de usuario ─────────────────────────────────────────────────────

  async selectUser(u: AppUser) {
    this.selectedUser.set(u);
    this.openGroupId = null;
    this.savedGlobal.set(false);
    this.savedGroupId.set(null);
    this.initGlobalTemp(u);
    await this.loadMemberships(u);
  }

  private initGlobalTemp(u: AppUser) {
    const map: Record<string, boolean> = {};
    ALL_PERMISSIONS.forEach(p => { map[p] = u.permissions.includes(p); });
    this.globalTemp.set(map);
    this.globalDirty.set(false);
  }

  private async loadMemberships(u: AppUser) {
    this.loadingMemberships.set(true);
    this.memberships.set([]);
    this.groupTemps.set({});
    this.groupDirty.set({});

    try {
      const memberships = await this.ps.getUserGroupMemberships(u.id);
      const result: GroupMembership[] = [];
      const temps: Record<string, Record<string, boolean>> = {};

      for (const m of memberships) {
        const group = this.ps.groups().find(g => g.id === m.groupId);
        if (!group) continue;

        result.push({
          groupId: m.groupId,
          groupName: group.nombre,
          groupColor: group.color,
          permissions: m.permissions,
        });

        const map: Record<string, boolean> = {};
        ALL_PERMISSIONS.forEach(p => { map[p] = m.permissions.includes(p); });
        temps[m.groupId] = map;
      }

      this.memberships.set(result);
      this.groupTemps.set(temps);
    } finally {
      this.loadingMemberships.set(false);
    }
  }

  // ── Globales ─────────────────────────────────────────────────────────────────

  toggleGlobal(p: string) {
    this.globalTemp.update(m => ({ ...m, [p]: !m[p] }));
    this.globalDirty.set(true);
    this.savedGlobal.set(false);
  }

  setAllGlobal(val: boolean) {
    const map: Record<string, boolean> = {};
    ALL_PERMISSIONS.forEach(p => { map[p] = val; });
    this.globalTemp.set(map);
    this.globalDirty.set(true);
    this.savedGlobal.set(false);
  }

  async saveGlobal() {
    const u = this.selectedUser();
    if (!u) return;
    this.savingGlobal.set(true);
    try {
      const perms = ALL_PERMISSIONS.filter(p => this.globalTemp()[p]) as Permission[];
      await this.ps.updateUser(u.id, { permissions: perms });

      // Actualizar el usuario seleccionado localmente para reflejar los nuevos permisos
      this.selectedUser.set({ ...u, permissions: perms });

      // Si el admin se modificó a sí mismo, refrescar permisos activos del servicio
      if (u.id === this.ps.currentUser()?.id) {
        await this.ps.refreshCurrentUserPermissions();
      }

      this.globalDirty.set(false);
      this.savedGlobal.set(true);
      this.msg.add({ severity: 'success', summary: 'Permisos globales guardados', detail: u.nombreCompleto, life: 2500 });
      setTimeout(() => this.savedGlobal.set(false), 3500);
    } catch (e: any) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: e.message, life: 3000 });
    } finally {
      this.savingGlobal.set(false);
    }
  }

  // ── Por grupo ─────────────────────────────────────────────────────────────────

  toggleGroupSection(groupId: string) {
    this.openGroupId = this.openGroupId === groupId ? null : groupId;
  }

  getGroupPerm(groupId: string, p: string): boolean {
    return this.groupTemps()[groupId]?.[p] ?? false;
  }

  toggleGroupPerm(groupId: string, p: string) {
    this.groupTemps.update(temps => ({
      ...temps,
      [groupId]: { ...(temps[groupId] ?? {}), [p]: !temps[groupId]?.[p] },
    }));
    this.groupDirty.update(d => ({ ...d, [groupId]: true }));
    if (this.savedGroupId() === groupId) this.savedGroupId.set(null);
  }

  setAllGroup(groupId: string, val: boolean) {
    const map: Record<string, boolean> = {};
    ALL_PERMISSIONS.forEach(p => { map[p] = val; });
    this.groupTemps.update(temps => ({ ...temps, [groupId]: map }));
    this.groupDirty.update(d => ({ ...d, [groupId]: true }));
  }

  async saveGroup(m: GroupMembership) {
    const u = this.selectedUser();
    if (!u) return;
    this.savingGroupId.set(m.groupId);
    try {
      const perms = ALL_PERMISSIONS.filter(p => this.groupTemps()[m.groupId]?.[p]) as Permission[];
      await this.ps.updateUserPermissionsInGroup(m.groupId, u.id, perms);

      // Si el admin modificó sus propios permisos de grupo, refrescar
      if (u.id === this.ps.currentUser()?.id) {
        await this.ps.refreshCurrentUserPermissions();
      }

      this.groupDirty.update(d => ({ ...d, [m.groupId]: false }));
      this.savedGroupId.set(m.groupId);
      this.msg.add({ severity: 'success', summary: `Permisos en "${m.groupName}" guardados`, life: 2500 });
      setTimeout(() => { if (this.savedGroupId() === m.groupId) this.savedGroupId.set(null); }, 3000);
    } catch (e: any) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: e.message, life: 3000 });
    } finally {
      this.savingGroupId.set(null);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  countInGroup(map: Record<string, boolean>, perms: readonly string[]): number {
    return perms.filter(p => map[p]).length;
  }

  countInGroupFromMap(map: Record<string, boolean>, perms: readonly string[]): number {
    return perms.filter(p => map[p]).length;
  }

  avatarColor(uid: string): string {
    let h = 0;
    for (let i = 0; i < uid.length; i++) h = uid.charCodeAt(i) + ((h << 5) - h);
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  }
}
