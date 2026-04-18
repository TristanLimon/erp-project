import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../components/sidebar/sidebar';
import { PermissionService } from '../../services/permission.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css'
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  sidebarCollapsed = false;

  private ps = inject(PermissionService);
  private refreshInterval: any;

  ngOnInit() {
    // Refrescar permisos cada 30 segundos para que los cambios
    // hechos por un admin se apliquen a los usuarios activos
    this.refreshInterval = setInterval(() => {
      this.ps.refreshCurrentUserPermissions();
    }, 30_000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}
