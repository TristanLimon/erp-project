import { Injectable } from '@angular/core';

export interface Usuario {
  usuario: string;
  email: string;
  password: string;
  nombreCompleto: string;
  direccion: string;
  telefono: string;
  fechaNacimiento: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  // ── Credenciales hardcodeadas (con datos completos) ───────────────
  private credenciales = [
    {
      email: 'admin@demo.com', password: 'Admin@2024!!',
      usuario: 'admin', nombreCompleto: 'Administrador Demo',
      direccion: 'Av. Reforma 123, CDMX', telefono: '5512345678',
      fechaNacimiento: '1990-01-15T00:00:00.000Z'
    },
    {
      email: 'usuario@demo.com', password: 'User#12345$',
      usuario: 'usuario_demo', nombreCompleto: 'Usuario Demo',
      direccion: 'Calle Juárez 456, Guadalajara', telefono: '3312345678',
      fechaNacimiento: '1995-06-20T00:00:00.000Z'
    },
  ];

  // ── Usuarios registrados en sesión ────────────────────────────────
  private usuariosRegistrados: Usuario[] = [];

  // ── Usuario activo ────────────────────────────────────────────────
  private _currentUser: Usuario | null = null;

  get currentUser(): Usuario | null {
    return this._currentUser;
  }

  login(email: string, password: string): boolean {
    const registrado = this.usuariosRegistrados.find(
      u => u.email === email && u.password === password
    );
    if (registrado) {
      this._currentUser = registrado;
      return true;
    }

    const hardcoded = this.credenciales.find(
      c => c.email === email && c.password === password
    );
    if (hardcoded) {
      this._currentUser = {
        usuario: hardcoded.usuario,
        email: hardcoded.email,
        password: hardcoded.password,
        nombreCompleto: hardcoded.nombreCompleto,
        direccion: hardcoded.direccion,
        telefono: hardcoded.telefono,
        fechaNacimiento: hardcoded.fechaNacimiento,
      };
      return true;
    }

    return false;
  }

  logout(): void {
    this._currentUser = null;
  }

  actualizarUsuario(datos: Partial<Usuario>): { ok: boolean; mensaje: string } {
    if (!this._currentUser) return { ok: false, mensaje: 'No hay sesión activa.' };

    // Verificar unicidad de usuario si cambió
    if (datos.usuario && datos.usuario !== this._currentUser.usuario) {
      const existe = this.usuariosRegistrados.some(u => u.usuario === datos.usuario)
        || this.credenciales.some(c => c.usuario === datos.usuario);
      if (existe) return { ok: false, mensaje: 'Ese nombre de usuario ya está en uso.' };
    }

    Object.assign(this._currentUser, datos);

    // Actualizar también en el arreglo de registrados si aplica
    const idx = this.usuariosRegistrados.findIndex(u => u.email === this._currentUser!.email);
    if (idx !== -1) this.usuariosRegistrados[idx] = { ...this._currentUser };

    return { ok: true, mensaje: 'Perfil actualizado correctamente.' };
  }

  darDeBaja(): void {
    if (!this._currentUser) return;
    this.usuariosRegistrados = this.usuariosRegistrados.filter(
      u => u.email !== this._currentUser!.email
    );
    this._currentUser = null;
  }

  registrar(usuario: Usuario): { ok: boolean; mensaje: string } {
    const emailExiste = this.usuariosRegistrados.some(u => u.email === usuario.email)
      || this.credenciales.some(c => c.email === usuario.email);

    if (emailExiste) {
      return { ok: false, mensaje: 'Este correo ya está registrado.' };
    }

    const usuarioExiste = this.usuariosRegistrados.some(u => u.usuario === usuario.usuario);
    if (usuarioExiste) {
      return { ok: false, mensaje: 'Este nombre de usuario ya está en uso.' };
    }

    this.usuariosRegistrados.push(usuario);
    return { ok: true, mensaje: 'Cuenta creada exitosamente.' };
  }
}