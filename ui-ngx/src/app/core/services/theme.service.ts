///
/// Copyright © 2016-2026 The Thingsboard Authors
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///     http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.
///


import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

const STORAGE_KEY = 'tb-theme';
const DARK_CLASS = 'tb-dark';

/**
 * App-wide light/dark switching. Dark is the default; 'light' is the opt-out.
 *
 * `.tb-dark` is a colour overlay that Material emits alongside `.tb-default`
 * (see theme.scss), so the class on <body> drives every stylesheet rule. The
 * preference is device-local: the same account may want dark on a laptop and
 * light on a projector, and localStorage lets the choice apply before Angular
 * boots (see the boot script in index.html), avoiding a flash of the wrong theme.
 *
 * Switching reloads the page: widgets resolve theme-dependent inline colours
 * (chart legends, panel backgrounds) once at init, so a class flip alone would
 * leave them stale. The boot script makes the reload flash-free.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {

  private darkSubject = new BehaviorSubject<boolean>(this.readStored());

  public isDark$: Observable<boolean> = this.darkSubject.asObservable();

  public get isDark(): boolean {
    return this.darkSubject.value;
  }

  public init(): void {
    this.apply(this.readStored());
  }

  public toggle(): void {
    this.setDark(!this.isDark);
  }

  public setDark(dark: boolean): void {
    this.apply(dark);
    try {
      localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
    } catch (e) {
      // private browsing or blocked storage - the theme still applies for this session
    }
    this.darkSubject.next(dark);
    window.location.reload();
  }

  private apply(dark: boolean): void {
    const body = document.body;
    if (!body) {
      return;
    }
    if (dark) {
      body.classList.add(DARK_CLASS);
    } else {
      body.classList.remove(DARK_CLASS);
    }
  }

  private readStored(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'light';
    } catch (e) {
      return true;
    }
  }
}
