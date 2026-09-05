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

import { Component, Input } from '@angular/core';

/**
 * Semantic tone of a status chip. Maps to the `--aq-*` semantic token family;
 * never to a literal colour.
 */
export type StatusChipTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/**
 * Data a table column supplies for one status cell. `label` is rendered as a
 * text interpolation (Angular escapes it), never as markup.
 */
export interface StatusChipContent {
  label: string;
  tone: StatusChipTone;
}

/**
 * A status pill: coloured dot + text label. Status is never conveyed by colour
 * alone — the label is always present, so the cell stays readable without
 * colour perception. Replaces the previous HTML-string pill, which carried
 * hardcoded colours in inline styles and had no dot.
 */
@Component({
    selector: 'tb-status-chip',
    templateUrl: './status-chip.component.html',
    styleUrls: ['./status-chip.component.scss'],
    standalone: false
})
export class StatusChipComponent {

  @Input()
  label: string;

  @Input()
  tone: StatusChipTone = 'neutral';
}
