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

import { AlarmSeverity } from '@shared/models/alarm.models';
import { StatusChipTone } from '@home/components/entity/status-chip.component';

/**
 * Single source of truth for alarm-severity chip tone. Both the entity alarm
 * table (`alarm-table-config.ts`) and the dashboard alarms widget
 * (`alarms-table-widget.component.ts`) map severity through this function, so
 * the two surfaces cannot drift apart.
 *
 * Tone maps to the `--aq-*` semantic token family, never to a literal colour.
 * MAJOR / MINOR / WARNING share the warning tone because the palette has no
 * distinct amber/orange/yellow trio; the chip always carries a text label, so
 * severity is never conveyed by colour alone and the three stay distinguishable.
 *
 * @param severity the alarm severity to classify.
 * @returns the semantic tone for the severity chip.
 */
export function alarmSeverityChipTone(severity: AlarmSeverity): StatusChipTone {
  switch (severity) {
    case AlarmSeverity.CRITICAL:
      return 'error';
    case AlarmSeverity.MAJOR:
    case AlarmSeverity.MINOR:
    case AlarmSeverity.WARNING:
      return 'warning';
    default:
      return 'neutral';
  }
}
