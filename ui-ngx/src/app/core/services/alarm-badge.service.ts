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
import { select, Store } from '@ngrx/store';
import { fromEvent, merge, Observable, of, timer } from 'rxjs';
import { catchError, distinctUntilChanged, map, shareReplay, switchMap } from 'rxjs/operators';
import { AppState } from '@core/core.state';
import { selectIsAuthenticated } from '@core/auth/auth.selectors';
import { AlarmService } from '@core/http/alarm.service';
import { AlarmQueryV2, AlarmSearchStatus } from '@shared/models/alarm.models';
import { TimePageLink } from '@shared/models/page/page-link';
import { Direction } from '@shared/models/page/sort-order';

const POLL_INTERVAL_MS = 60000;
const COUNT_PAGE_SIZE = 1;

/**
 * Single source of the active-alarm count for the left menu.
 *
 * One shared HTTP request every 60s for the whole application, regardless of how
 * many menu rows subscribe: the expanded badge and the collapsed rail dot are two
 * subscribers to one stream. Polling stops while the tab is hidden and while no
 * user is authenticated. The demo server is a single small VM - do not add load.
 */
@Injectable({
  providedIn: 'root'
})
export class AlarmBadgeService {

  readonly activeAlarmCount$: Observable<number>;

  constructor(private store: Store<AppState>,
              private alarmService: AlarmService) {
    const visible$ = merge(
      fromEvent(document, 'visibilitychange'),
      of(null)
    ).pipe(
      map(() => document.visibilityState !== 'hidden'),
      distinctUntilChanged()
    );

    this.activeAlarmCount$ = this.store.pipe(select(selectIsAuthenticated)).pipe(
      switchMap((authenticated) => authenticated ? visible$ : of(false)),
      switchMap((active) => active ? timer(0, POLL_INTERVAL_MS) : of(null)),
      switchMap((tick) => tick === null ? of(0) : this.fetchCount()),
      distinctUntilChanged(),
      shareReplay({bufferSize: 1, refCount: true})
    );
  }

  /**
   * Fetches only the page metadata: there is no count endpoint, so the count is
   * PageData.totalElements and a single row is requested. statusList=ACTIVE is
   * mandatory - unfiltered the endpoint returns every alarm ever raised.
   * catchError sits INSIDE this method so a network blip cannot kill the timer.
   */
  private fetchCount(): Observable<number> {
    const pageLink = new TimePageLink(COUNT_PAGE_SIZE, 0, null,
      {property: 'createdTime', direction: Direction.DESC});
    const query = new AlarmQueryV2(null, pageLink, {
      typeList: null,
      statusList: [AlarmSearchStatus.ACTIVE],
      severityList: null
    });
    return this.alarmService.getAllAlarmsV2(query, {ignoreErrors: true, ignoreLoading: true}).pipe(
      map((pageData) => pageData.totalElements),
      catchError(() => of(0))
    );
  }
}
