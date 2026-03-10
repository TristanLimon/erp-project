import { Directive, Input, TemplateRef, ViewContainerRef, OnInit, OnDestroy, effect, inject } from '@angular/core';
import { Permission, PermissionService } from '../services/permission.service';

/**
 * Structural directive to show/hide elements based on permissions.
 *
 * Usage:
 *   *hasPermission="'ticket:create'"
 *   *hasPermission="['ticket:create', 'ticket:edit']"  (any of these)
 *   [hasPermissionAll]="['ticket:create', 'ticket:edit']"  (all of these)
 */
@Directive({
  selector: '[hasPermission]',
  standalone: true,
})
export class HasPermissionDirective implements OnInit {
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private permService = inject(PermissionService);

  private _permissions: Permission[] = [];
  private _mode: 'any' | 'all' = 'any';
  private _created = false;

  @Input() set hasPermission(value: Permission | Permission[]) {
    this._permissions = Array.isArray(value) ? value : [value];
    this._mode = 'any';
    this.updateView();
  }

  @Input() set hasPermissionAll(value: Permission[]) {
    this._permissions = value;
    this._mode = 'all';
    this.updateView();
  }

  ngOnInit() { this.updateView(); }

  private updateView() {
    const allowed = this._mode === 'all'
      ? this.permService.hasAll(...this._permissions)
      : this.permService.hasAny(...this._permissions);

    if (allowed && !this._created) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._created = true;
    } else if (!allowed && this._created) {
      this.viewContainer.clear();
      this._created = false;
    }
  }
}
