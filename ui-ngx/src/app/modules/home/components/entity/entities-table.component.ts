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

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { PageComponent } from '@shared/components/page.component';
import { Store } from '@ngrx/store';
import { AppState } from '@core/core.state';
import { MAX_SAFE_PAGE_SIZE, PageLink, PageQueryParam, TimePageLink } from '@shared/models/page/page-link';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, SortDirection } from '@angular/material/sort';
import { EntitiesDataSource } from '@home/models/datasource/entity-datasource';
import { catchError, debounceTime, distinctUntilChanged, map, skip, take, takeUntil } from 'rxjs/operators';
import { Direction, SortOrder } from '@shared/models/page/sort-order';
import { forkJoin, merge, Observable, of, Subject, Subscription } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { BaseData, HasId } from '@shared/models/base-data';
import { ActivatedRoute, QueryParamsHandling, Router } from '@angular/router';
import {
  CellActionDescriptor,
  CellActionDescriptorType,
  EntityActionTableColumn,
  EntityChipsEntityTableColumn,
  EntityColumn, EntityColumnsType, EntityColumnType,
  EntityLinkTableColumn,
  EntityStatusChipTableColumn,
  EntityTableColumn,
  EntityTableConfig,
  GroupActionDescriptor,
  HeaderActionDescriptor
} from '@home/models/entity/entities-table-config.models';
import { EntityTypeTranslation } from '@shared/models/entity-type.models';
import { DialogService } from '@core/services/dialog.service';
import { AddEntityDialogComponent } from './add-entity-dialog.component';
import { AddEntityDialogData, EntityAction } from '@home/models/entity/entity-component.models';
import { getTimePageLinkInterval, Timewindow } from '@shared/models/time/time.models';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TbAnchorComponent } from '@shared/components/tb-anchor.component';
import { isDefined, isEqual, isNotEmptyStr, isUndefined } from '@core/utils';
import { HasUUID } from '@shared/models/id/has-uuid';
import { hidePageSizePixelValue } from '@shared/models/constants';
import { EntitiesTableAction, IEntitiesTableComponent } from '@home/models/entity/entity-table-component.models';
import { EntityDetailsPanelComponent } from '@home/components/entity/entity-details-panel.component';
import { FormBuilder } from '@angular/forms';

@Component({
    selector: 'tb-entities-table',
    templateUrl: './entities-table.component.html',
    styleUrls: ['./entities-table.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class EntitiesTableComponent extends PageComponent implements IEntitiesTableComponent, AfterViewInit, OnInit, OnChanges, OnDestroy {

  @Input()
  entitiesTableConfig: EntityTableConfig<BaseData<HasId>>;

  translations: EntityTypeTranslation;

  headerActionDescriptors: Array<HeaderActionDescriptor>;
  groupActionDescriptors: Array<GroupActionDescriptor<BaseData<HasId>>>;
  cellActionDescriptors: Array<CellActionDescriptor<BaseData<HasId>>>;

  actionColumns: Array<EntityActionTableColumn<BaseData<HasId>>>;
  entityColumns: EntityColumnsType;
  displayedColumns: string[];

  headerCellStyleCache: Array<any> = [];

  cellContentCache: Array<SafeHtml> = [];
  cellTooltipCache: Array<string> = [];

  cellStyleCache: Array<any> = [];

  selectionEnabled;

  defaultPageSize = 10;
  displayPagination = true;
  hidePageSize = false;
  /** Total record count last reported by the data source; drives the pager. */
  totalEntities = 0;
  /** Page indices to render as chips; `null` marks an ellipsis gap. */
  pageNumbers: Array<number | null> = [];
  pageSizeOptions;
  pageLink: PageLink;
  pageMode = true;
  textSearchMode = false;
  timewindow: Timewindow;
  dataSource: EntitiesDataSource<BaseData<HasId>>;

  cellActionType = CellActionDescriptorType;

  isDetailsOpen = false;
  detailsPanelOpened = new EventEmitter<boolean>();

  @ViewChild('entityTableHeader', {static: true}) entityTableHeaderAnchor: TbAnchorComponent;

  @ViewChild('searchInput') searchInputField: ElementRef;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  @ViewChild('entityDetailsPanel') entityDetailsPanel: EntityDetailsPanelComponent;

  textSearch = this.fb.control('', {nonNullable: true});

  private updateDataSubscription: Subscription;
  private viewInited = false;

  private widgetResize$: ResizeObserver;
  private destroy$ = new Subject<void>();

  constructor(protected store: Store<AppState>,
              public route: ActivatedRoute,
              public translate: TranslateService,
              public dialog: MatDialog,
              private dialogService: DialogService,
              private domSanitizer: DomSanitizer,
              private cd: ChangeDetectorRef,
              private router: Router,
              private elementRef: ElementRef,
              private fb: FormBuilder,
              private zone: NgZone,
              public viewContainerRef: ViewContainerRef) {
    super(store);
  }

  ngOnInit() {
    if (this.entitiesTableConfig) {
      this.init(this.entitiesTableConfig);
    } else {
      this.route.data.pipe(
        takeUntil(this.destroy$)
      ).subscribe((data) => {
          this.init(data.entitiesTableConfig);
      });
    }
    this.widgetResize$ = new ResizeObserver(() => {
      this.zone.run(() => {
        const showHidePageSize = this.elementRef.nativeElement.offsetWidth < hidePageSizePixelValue;
        if (showHidePageSize !== this.hidePageSize) {
          this.hidePageSize = showHidePageSize;
          this.cd.markForCheck();
        }
      });
    });
    this.widgetResize$.observe(this.elementRef.nativeElement);
  }

  ngOnDestroy() {
    if (this.widgetResize$) {
      this.widgetResize$.disconnect();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnChanges(changes: SimpleChanges): void {
    for (const propName of Object.keys(changes)) {
      const change = changes[propName];
      if (!change.firstChange && change.currentValue !== change.previousValue) {
        if (propName === 'entitiesTableConfig' && change.currentValue) {
          this.init(change.currentValue);
        }
      }
    }
  }

  private init(entitiesTableConfig: EntityTableConfig<BaseData<HasId>>) {
    this.isDetailsOpen = false;
    this.entitiesTableConfig = entitiesTableConfig;
    this.pageMode = this.entitiesTableConfig.pageMode;
    if (this.entitiesTableConfig.headerComponent) {
      const viewContainerRef = this.entityTableHeaderAnchor.viewContainerRef;
      viewContainerRef.clear();
      const componentRef = viewContainerRef.createComponent(this.entitiesTableConfig.headerComponent);
      const headerComponent = componentRef.instance;
      headerComponent.entitiesTableConfig = this.entitiesTableConfig;
    }

    this.entitiesTableConfig.setTable(this);
    this.translations = this.entitiesTableConfig.entityTranslations;

    this.headerActionDescriptors = [...this.entitiesTableConfig.headerActionDescriptors];
    this.groupActionDescriptors = [...this.entitiesTableConfig.groupActionDescriptors];
    this.cellActionDescriptors = [...this.entitiesTableConfig.cellActionDescriptors];

    if (this.entitiesTableConfig.entitiesDeleteEnabled) {
      this.cellActionDescriptors.push(
        {
          name: this.translate.instant('action.delete'),
          icon: 'delete',
          isEnabled: entity => this.entitiesTableConfig.deleteEnabled(entity),
          onAction: ($event, entity) => this.deleteEntity($event, entity)
        }
      );
      this.groupActionDescriptors.push(
        {
          name: this.translate.instant('action.delete'),
          icon: 'delete',
          isEnabled: true,
          onAction: ($event, entities) => this.deleteEntities($event, entities)
        }
      );
    }

    const enabledGroupActionDescriptors =
      this.groupActionDescriptors.filter((descriptor) => descriptor.isEnabled);

    this.selectionEnabled = this.entitiesTableConfig.selectionEnabled && enabledGroupActionDescriptors.length;

    this.columnsUpdated();

    const routerQueryParams: PageQueryParam = this.route.snapshot.queryParams;

    let sortOrder: SortOrder = null;
    let initialAction: EntitiesTableAction = null;
    if (this.pageMode) {
      initialAction = routerQueryParams?.action;
      if (this.entitiesTableConfig.defaultSortOrder || routerQueryParams.hasOwnProperty('direction')
        || routerQueryParams.hasOwnProperty('property')) {
        sortOrder = {
          property: routerQueryParams?.property || this.entitiesTableConfig.defaultSortOrder.property,
          direction: routerQueryParams?.direction || this.entitiesTableConfig.defaultSortOrder.direction
        };
      }
    } else if (this.entitiesTableConfig.defaultSortOrder){
      sortOrder = {
        property: this.entitiesTableConfig.defaultSortOrder.property,
        direction: this.entitiesTableConfig.defaultSortOrder.direction
      };
    }

    this.displayPagination = this.entitiesTableConfig.displayPagination;
    this.defaultPageSize = this.entitiesTableConfig.defaultPageSize;
    this.pageSizeOptions = [this.defaultPageSize, this.defaultPageSize * 2, this.defaultPageSize * 3];

    if (this.entitiesTableConfig.useTimePageLink) {
      this.timewindow = this.entitiesTableConfig.defaultTimewindowInterval;
      const interval = getTimePageLinkInterval(this.timewindow);
      this.pageLink = new TimePageLink(10, 0, null, sortOrder,
        interval.startTime, interval.endTime);
    } else {
      this.pageLink = new PageLink(10, 0, null, sortOrder);
    }
    this.pageLink.pageSize = this.displayPagination ? this.defaultPageSize : MAX_SAFE_PAGE_SIZE;
    if (this.pageMode) {
      if (routerQueryParams.hasOwnProperty('page')) {
        this.pageLink.page = Number(routerQueryParams.page);
      }
      if (routerQueryParams.hasOwnProperty('pageSize')) {
        this.pageLink.pageSize = Number(routerQueryParams.pageSize);
      }
      const textSearchParam = routerQueryParams.textSearch;
      if (isNotEmptyStr(textSearchParam)) {
        const decodedTextSearch = decodeURI(textSearchParam);
        this.textSearchMode = true;
        this.pageLink.textSearch = decodedTextSearch.trim();
        this.textSearch.setValue(decodedTextSearch, {emitEvent: false});
      }
    }
    this.dataSource = this.entitiesTableConfig.dataSource(this.dataLoaded.bind(this));
    if (this.entitiesTableConfig.onLoadAction) {
      this.entitiesTableConfig.onLoadAction(this.route);
    }
    if (this.entitiesTableConfig.loadDataOnInit) {
      this.dataSource.loadEntities(this.pageLink);
    }
    if (this.viewInited) {
      setTimeout(() => {
        this.updatePaginationSubscriptions();
      }, 0);
    }
    if (this.pageMode) {
      if (initialAction) {
        const queryParams: PageQueryParam = {};
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams,
          queryParamsHandling: '',
          replaceUrl: true
        });
      }
      if (initialAction === 'add') {
        setTimeout(() => {
          this.addEntity(null);
        }, 0);
      }
    }
  }

  ngAfterViewInit() {
    this.textSearch.valueChanges.pipe(
      debounceTime(150),
      distinctUntilChanged((prev, current) => (this.pageLink.textSearch ?? '') === current.trim()),
      takeUntil(this.destroy$)
    ).subscribe(value => {
      if (this.pageMode) {
        const queryParams: PageQueryParam = {
          textSearch: isNotEmptyStr(value) ? encodeURI(value) : null,
          page: null
        };
        this.updatedRouterParamsAndData(queryParams);
      } else {
        this.pageLink.textSearch = isNotEmptyStr(value) ? value.trim() : null;
        if (this.displayPagination) {
          this.paginator.pageIndex = 0;
        }
        this.updateData();
      }
    });

    if (this.pageMode) {
      this.route.queryParams.pipe(
        skip(1),
        takeUntil(this.destroy$)
      ).subscribe((params: PageQueryParam) => {
        if (this.displayPagination) {
          this.paginator.pageIndex = Number(params.page) || 0;
          this.paginator.pageSize = Number(params.pageSize) || this.defaultPageSize;
        }
        this.sort.active = params.property || this.entitiesTableConfig.defaultSortOrder.property;
        this.sort.direction = (params.direction || this.entitiesTableConfig.defaultSortOrder.direction).toLowerCase() as SortDirection;
        const textSearchParam = params.textSearch;
        if (isNotEmptyStr(textSearchParam)) {
          const decodedTextSearch = decodeURI(textSearchParam);
          this.textSearchMode = true;
          this.pageLink.textSearch = decodedTextSearch.trim();
          this.textSearch.setValue(decodedTextSearch, {emitEvent: false});
        } else {
          this.pageLink.textSearch = null;
          this.textSearch.reset('', {emitEvent: false});
        }
        this.updateData();
      });
    }

    this.updatePaginationSubscriptions();
    this.viewInited = true;
  }

  private updatePaginationSubscriptions() {
    if (this.updateDataSubscription) {
      this.updateDataSubscription.unsubscribe();
      this.updateDataSubscription = null;
    }
    let paginatorSubscription$: Observable<object>;
    const sortSubscription$: Observable<object> = this.sort.sortChange.asObservable().pipe(
      map((data) => {
        const direction = data.direction.toUpperCase();
        const queryParams: PageQueryParam = {
          direction: (this.entitiesTableConfig?.defaultSortOrder?.direction === direction ? null : direction) as Direction,
          property: this.entitiesTableConfig?.defaultSortOrder?.property === data.active ? null : data.active
        };
        if (this.displayPagination) {
          queryParams.page = null;
          this.paginator.pageIndex = 0;
        }
        return queryParams;
      })
    );
    if (this.displayPagination) {
      paginatorSubscription$ = this.paginator.page.asObservable().pipe(
        map((data) => ({
          page: data.pageIndex === 0 ? null : data.pageIndex,
          pageSize: data.pageSize === this.defaultPageSize ? null : data.pageSize
        }))
      );
    }
    this.updateDataSubscription = ((this.displayPagination ? merge(sortSubscription$, paginatorSubscription$)
      : sortSubscription$) as Observable<PageQueryParam>).pipe(
      takeUntil(this.destroy$)
    ).subscribe(queryParams => this.updatedRouterParamsAndData(queryParams));
  }

  addEnabled() {
    return this.entitiesTableConfig.addEnabled;
  }

  clearSelection() {
    this.dataSource.selection.clear();
    this.cd.detectChanges();
  }

  updateData(closeDetails: boolean = true, reloadEntity: boolean = true) {
    if (closeDetails) {
      this.isDetailsOpen = false;
    }
    if (this.displayPagination) {
      this.pageLink.page = this.paginator.pageIndex;
      this.pageLink.pageSize = this.paginator.pageSize;
    } else {
      this.pageLink.page = 0;
    }
    if (this.sort.active) {
      this.pageLink.sortOrder = {
        property: this.sort.active,
        direction: Direction[this.sort.direction.toUpperCase()]
      };
    } else {
      this.pageLink.sortOrder = null;
    }
    if (this.entitiesTableConfig.useTimePageLink) {
      const timePageLink = this.pageLink as TimePageLink;
      const interval = getTimePageLinkInterval(this.timewindow);
      timePageLink.startTime = interval.startTime;
      timePageLink.endTime = interval.endTime;
    }
    this.dataSource.loadEntities(this.pageLink);
    if (reloadEntity && this.isDetailsOpen && this.entityDetailsPanel) {
      this.entityDetailsPanel.reloadEntity();
    }
  }

  private dataLoaded(col?: number, row?: number) {
    if (isFinite(col) && isFinite(row)) {
      // Single-cell refresh: the row count cannot have changed, so skip the
      // total() read below rather than resubscribing once per cell.
      this.clearCellCache(col, row);
      return;
    }
    this.headerCellStyleCache.length = 0;
    this.cellContentCache.length = 0;
    this.cellTooltipCache.length = 0;
    this.cellStyleCache.length = 0;
    this.dataSource.total().pipe(take(1)).subscribe((total) => {
      this.totalEntities = total ?? 0;
      this.updatePageNumbers();
      this.cd.markForCheck();
    });
  }

  onRowClick($event: Event, entity) {
    if (!this.entitiesTableConfig.handleRowClick($event, entity)) {
      this.toggleEntityDetails($event, entity);
    }
  }

  toggleEntityDetails($event: Event, entity) {
    if ($event) {
      $event.stopPropagation();
    }
    if (this.dataSource.toggleCurrentEntity(entity)) {
      this.isDetailsOpen = true;
    } else {
      this.isDetailsOpen = !this.isDetailsOpen;
    }
    this.detailsPanelOpened.emit(this.isDetailsOpen);
  }

  addEntity($event: Event) {
    let entity$: Observable<BaseData<HasId>>;
    if (this.entitiesTableConfig.addEntity) {
      entity$ = this.entitiesTableConfig.addEntity();
    } else {
      entity$ = this.dialog.open<AddEntityDialogComponent, AddEntityDialogData<BaseData<HasId>>,
                                 BaseData<HasId>>(AddEntityDialogComponent, {
        disableClose: true,
        panelClass: ['tb-dialog', 'tb-fullscreen-dialog'],
        data: {
          entitiesTableConfig: this.entitiesTableConfig
        }
      }).afterClosed();
    }
    entity$.subscribe(
      (entity) => {
        if (entity) {
          this.updateData();
          this.entitiesTableConfig.entityAdded(entity);
        }
      }
    );
  }

  onEntityUpdated(entity: BaseData<HasId>) {
    this.updateData(false, false);
    this.entitiesTableConfig.entityUpdated(entity);
  }

  onEntityAction(action: EntityAction<BaseData<HasId>>) {
    if (action.action === 'delete') {
      this.deleteEntity(action.event, action.entity);
    }
  }

  deleteEntity($event: Event, entity: BaseData<HasId>) {
    if ($event) {
      $event.stopPropagation();
    }
    this.dialogService.confirm(
      this.entitiesTableConfig.deleteEntityTitle(entity),
      this.entitiesTableConfig.deleteEntityContent(entity),
      this.translate.instant('action.no'),
      this.translate.instant('action.yes'),
      true
    ).subscribe((result) => {
      if (result) {
        this.entitiesTableConfig.deleteEntity(entity.id).subscribe(
          () => {
            this.updateData();
            this.entitiesTableConfig.entitiesDeleted([entity.id]);
          }
        );
      }
    });
  }

  deleteEntities($event: Event, entities: BaseData<HasId>[]) {
    if ($event) {
      $event.stopPropagation();
    }
    this.dialogService.confirm(
      this.entitiesTableConfig.deleteEntitiesTitle(entities.length),
      this.entitiesTableConfig.deleteEntitiesContent(entities.length),
      this.translate.instant('action.no'),
      this.translate.instant('action.yes'),
      true
    ).subscribe((result) => {
      if (result) {
        const tasks: Observable<HasUUID>[] = [];
        entities.forEach((entity) => {
          if (this.entitiesTableConfig.deleteEnabled(entity)) {
            tasks.push(this.entitiesTableConfig.deleteEntity(entity.id).pipe(
              map(() => entity.id),
              catchError(() => of(null)
            )));
          }
        });
        forkJoin(tasks).subscribe(
          (ids) => {
            this.updateData();
            this.entitiesTableConfig.entitiesDeleted(ids.filter(id => id !== null));
          }
        );
      }
    });
  }

  onTimewindowChange() {
    if (this.displayPagination) {
      this.paginator.pageIndex = 0;
    }
    this.updateData();
  }

  /** Number of pages currently available. */
  get totalPages(): number {
    if (!this.displayPagination || !this.pageLink.pageSize) {
      return 1;
    }
    return Math.max(1, Math.ceil(this.totalEntities / this.pageLink.pageSize));
  }

  /**
   * Windowed page list: up to 5 numbered chips around the current page, with
   * `null` standing in for an elided run, plus always the first and last page.
   * Keeps the footer a fixed width however many pages exist (D3).
   */
  private updatePageNumbers() {
    const total = this.totalPages;
    const current = this.pageLink.page;
    const windowSize = 5;
    if (total <= windowSize + 2) {
      this.pageNumbers = Array.from({length: total}, (_, i) => i);
      return;
    }
    const half = Math.floor(windowSize / 2);
    let start = Math.max(1, current - half);
    const end = Math.min(total - 2, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    const pages: Array<number | null> = [0];
    if (start > 1) {
      pages.push(null);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (end < total - 2) {
      pages.push(null);
    }
    pages.push(total - 1);
    this.pageNumbers = pages;
  }

  /**
   * Move to `pageIndex` through MatPaginator so every existing subscription fires.
   *
   * Clamps rather than rejects: `totalPages` derives from `totalEntities`, which
   * only refreshes in `dataLoaded()`, so a click landing during an in-flight
   * reload can carry an index past the end of the new, shorter result. Clamping
   * lands on the last real page instead of silently doing nothing.
   *
   * `previousPageIndex` is captured before the assignment and included in the
   * emitted event, because MatPaginator's own `_emitPageEvent` always supplies
   * it and subscribers may rely on it.
   */
  goToPage(pageIndex: number) {
    const target = Math.min(Math.max(pageIndex, 0), this.totalPages - 1);
    if (target === this.paginator.pageIndex) {
      return;
    }
    const previousPageIndex = this.paginator.pageIndex;
    this.paginator.pageIndex = target;
    this.paginator.page.emit({
      previousPageIndex,
      pageIndex: target,
      pageSize: this.paginator.pageSize,
      length: this.paginator.length
    });
  }

  /**
   * Just the "1-10" part of the range; the surrounding words come from
   * translation keys in the template, so the translated strings stay
   * markup-free. Deliberately does NOT reach into MatPaginator's `_intl`
   * (a private Material API used nowhere else in this codebase).
   */
  get rangeText(): string {
    if (!this.totalEntities || !this.pageLink.pageSize) {
      return '0';
    }
    const start = this.pageLink.page * this.pageLink.pageSize + 1;
    const end = Math.min(this.pageLink.pageSize * (this.pageLink.page + 1), this.totalEntities);
    return `${start}–${end}`;
  }

  /**
   * The search field is always visible now, so this only moves focus into it.
   *
   * `textSearchMode` is retained for backwards compatibility only: it is part
   * of this component's public API and is still assigned here and in
   * exitFilterMode()/resetSortAndFilter(), but nothing in this component or its
   * template reads it. The query-param sync sets `pageLink.textSearch` and calls
   * `textSearch.setValue()` directly, independently of this flag.
   */
  enterFilterMode() {
    this.textSearchMode = true;
    setTimeout(() => {
      if (this.searchInputField) {
        this.searchInputField.nativeElement.focus();
        this.searchInputField.nativeElement.setSelectionRange(0, 0);
      }
    }, 10);
  }

  exitFilterMode() {
    this.textSearchMode = false;
    this.textSearch.reset();
  }

  resetSortAndFilter(update: boolean = true, preserveTimewindow: boolean = false) {
    this.textSearchMode = false;
    this.pageLink.textSearch = null;
    this.textSearch.reset('', {emitEvent: false});
    if (this.entitiesTableConfig.useTimePageLink && !preserveTimewindow) {
      this.timewindow = this.entitiesTableConfig.defaultTimewindowInterval;
    }
    if (this.displayPagination) {
      this.paginator.pageIndex = 0;
    }
    const sortable = this.sort.sortables.get(this.entitiesTableConfig.defaultSortOrder.property);
    this.sort.active = sortable.id;
    this.sort.direction = this.entitiesTableConfig.defaultSortOrder.direction === Direction.ASC ? 'asc' : 'desc';
    if (update) {
      this.updatedRouterParamsAndData({}, '');
    }
  }

  columnsUpdated(resetData: boolean = false) {
    this.entityColumns = this.entitiesTableConfig.columns.filter(
      (column) => column instanceof EntityTableColumn || column instanceof EntityLinkTableColumn ||
        column instanceof EntityChipsEntityTableColumn || column instanceof EntityStatusChipTableColumn);
    this.actionColumns = this.entitiesTableConfig.columns.filter(
      (column) => column instanceof EntityActionTableColumn)
      .map(column => column as EntityActionTableColumn<BaseData<HasId>>);

    this.displayedColumns = [];

    if (this.selectionEnabled) {
      this.displayedColumns.push('select');
    }
    this.entitiesTableConfig.columns.forEach(
      (column) => {
        this.displayedColumns.push(column.key);
      }
    );
    this.displayedColumns.push('actions');
    this.headerCellStyleCache.length = 0;
    this.cellContentCache.length = 0;
    this.cellTooltipCache.length = 0;
    this.cellStyleCache.length = 0;
    if (resetData) {
      this.dataSource.reset();
    }
  }

  cellActionDescriptorsUpdated() {
    this.cellActionDescriptors = [...this.entitiesTableConfig.cellActionDescriptors];
  }

  headerCellStyle(column: EntityColumnType) {
    const index = this.entitiesTableConfig.columns.indexOf(column as EntityColumn<BaseData<HasId>>);
    let res = this.headerCellStyleCache[index];
    if (!res) {
      const widthStyle: any = {width: column.width};
      if (column.width !== '0px') {
        widthStyle.minWidth = column.width;
        widthStyle.maxWidth = column.width;
      }
      if (column instanceof EntityTableColumn) {
        res = {...column.headerCellStyleFunction(column.key), ...widthStyle};
      } else {
        res = widthStyle;
      }
      this.headerCellStyleCache[index] = res;
    }
    return res;
  }

  clearCellCache(col: number, row: number) {
    const index = row * this.entitiesTableConfig.columns.length + col;
    this.cellContentCache[index] = undefined;
    this.cellTooltipCache[index] = undefined;
    this.cellStyleCache[index] = undefined;
  }

  cellContent(entity: BaseData<HasId>, column: EntityColumnType, row: number) {
    if (column instanceof EntityTableColumn || column instanceof EntityLinkTableColumn) {
      const col = this.entitiesTableConfig.columns.indexOf(column);
      const index = row * this.entitiesTableConfig.columns.length + col;
      let res = this.cellContentCache[index];
      if (isUndefined(res)) {
        res = this.domSanitizer.bypassSecurityTrustHtml(column.cellContentFunction(entity, column.key));
        this.cellContentCache[index] = res;
      }
      return res;
    } else {
      return '';
    }
  }

  cellTooltip(entity: BaseData<HasId>, column: EntityColumnType, row: number) {
    if (column instanceof EntityTableColumn || column instanceof EntityLinkTableColumn) {
      const col = this.entitiesTableConfig.columns.indexOf(column);
      const index = row * this.entitiesTableConfig.columns.length + col;
      let res = this.cellTooltipCache[index];
      if (isUndefined(res)) {
        res = column.cellTooltipFunction(entity, column.key);
        res = isDefined(res) ? res : null;
        this.cellTooltipCache[index] = res;
      } else {
        return res !== null ? res : undefined;
      }
    } else {
      return undefined;
    }
  }

  cellStyle(entity: BaseData<HasId>, column: EntityColumnType, row: number) {
    const col = this.entitiesTableConfig.columns.indexOf(column as EntityColumn<BaseData<HasId>>);
    const index = row * this.entitiesTableConfig.columns.length + col;
    let res = this.cellStyleCache[index];
    if (!res) {
      const widthStyle: any = {width: column.width};
      if (column.width !== '0px') {
        widthStyle.minWidth = column.width;
        widthStyle.maxWidth = column.width;
      }
      if (column instanceof EntityTableColumn) {
        res = {...column.cellStyleFunction(entity, column.key), ...widthStyle};
      } else {
        res = widthStyle;
      }
      this.cellStyleCache[index] = res;
    }
    return res;
  }

  trackByEntityId(index: number, entity: BaseData<HasId>) {
    return entity.id.id;
  }

  protected updatedRouterParamsAndData(queryParams: object, queryParamsHandling: QueryParamsHandling = 'merge') {
    if (this.pageMode) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams,
        queryParamsHandling
      });
      if (queryParamsHandling === '' && isEqual(this.route.snapshot.queryParams, queryParams)) {
        this.updateData();
      }
    } else {
      this.updateData();
    }
  }

  detectChanges() {
    this.cd.markForCheck();
  }
}
