import { Directive, Input, TemplateRef, ViewContainerRef, effect, inject, signal } from '@angular/core';
import { Permission, PermissionService } from '../services/permission.service';

/**
 * Structural directive to show/hide elements based on permissions.
 * Reactively updates when permissions change at runtime via Angular signals.
 *
 * Usage:
 *   *hasPermission="'ticket:create'"
 *   *hasPermission="['ticket:create', 'ticket:edit']"  (any of these)
 *   *hasPermission="'ticket:create'; else noPerm"       (with else template)
 */
@Directive({
  selector: '[hasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private permService = inject(PermissionService);

  /** Permissions to check — as a signal so effect() can track changes */
  private _permissions = signal<Permission[]>([]);
  /** Mode: any or all — as a signal so effect() can track changes */
  private _mode = signal<'any' | 'all'>('any');
  private _created = false;
  private _elseCreated = false;
  private _elseRef: TemplateRef<any> | null = null;

  @Input() set hasPermission(value: Permission | Permission[]) {
    this._permissions.set(Array.isArray(value) ? value : [value]);
    this._mode.set('any');
  }

  @Input() set hasPermissionAll(value: Permission[]) {
    this._permissions.set(value);
    this._mode.set('all');
  }

  /** ng-template companion for *hasPermission="expr; else tpl" */
  @Input() set hasPermissionElse(ref: TemplateRef<any>) {
    this._elseRef = ref;
  }

  constructor() {
    // Reactive effect: re-evaluates whenever permission signals OR input signals change
    effect(() => {
      const perms = this._permissions();
      const mode = this._mode();

      // Read the reactive permission signals to establish tracking
      // Access globalPermissions and activePermissions to ensure tracking
      const gp = this.permService.globalPermissions();
      const ap = this.permService.activePermissions();

      // Now compute if allowed
      let allowed: boolean;
      if (perms.length === 0) {
        allowed = false;
      } else {
        allowed = mode === 'all'
          ? perms.every(p => gp.includes(p) || ap.includes(p))
          : perms.some(p => gp.includes(p) || ap.includes(p));
      }

      if (allowed && !this._created) {
        this.viewContainer.clear();
        this._elseCreated = false;
        this.viewContainer.createEmbeddedView(this.templateRef);
        this._created = true;
      } else if (!allowed && this._created) {
        this.viewContainer.clear();
        this._created = false;
        if (this._elseRef) {
          this.viewContainer.createEmbeddedView(this._elseRef);
          this._elseCreated = true;
        }
      } else if (!allowed && !this._created && !this._elseCreated && this._elseRef) {
        this.viewContainer.clear();
        this.viewContainer.createEmbeddedView(this._elseRef);
        this._elseCreated = true;
      }
    });
  }
}
