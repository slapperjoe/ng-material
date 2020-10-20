import { Component, OnInit, OnDestroy, Input, EventEmitter, Output, ViewChild, AfterViewInit,
  Renderer2, OnChanges, SimpleChanges } from '@angular/core';
import { FormGroup, FormControl, AbstractControl } from '@angular/forms';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';
import { coerceNumberProperty } from '@angular/cdk/coercion';
import { MatSlider } from '@angular/material/slider';
import { merge, Subject } from 'rxjs';
import { tap, takeUntil, map } from 'rxjs/operators';
import { NumberRange } from './number-range.model';

export interface RangeSliderChange<T extends NumberRange> {
  value: NumberRange;
}

@Component({
  selector: 'app-range-slider',
  templateUrl: './range-slider.component.html',
  styleUrls: ['./range-slider.component.less'],
  providers: [{
      provide: NG_VALUE_ACCESSOR,
      useExisting: RangeSliderComponent,
      multi: true
    }
  ]
})
export class RangeSliderComponent<T extends NumberRange>
    implements OnInit, OnDestroy, AfterViewInit, OnChanges, ControlValueAccessor {

  @ViewChild('sMin', {static: true}) _sliderMin: MatSlider;
  @ViewChild('sMax', {static: true}) _sliderMax: MatSlider;

  beforeOnInit = true;

  _fillBarEl: HTMLElement;

  _switchCase = false;

  private _ngOnDestroy = new Subject();

  formGroup = new FormGroup({
    min: new FormControl(),
    max: new FormControl()
  });

  private _value: NumberRange | null = null;

  @Input() disabled = false;
  @Input() tabIndex: number;
  @Input() min = 0;
  @Input() max = 100;
  @Input() invert = false;
  @Input() step = 5;
  @Input() vertical = false;
  @Input() thumbLabel = false;
  @Input() color = 'primary';
  @Input() tickInterval = 10;
  @Input() displayWith: (value: number) => string | number;

  // tslint:disable-next-line:no-output-native
  @Output() readonly change = new EventEmitter<RangeSliderChange<NumberRange>>();

  /** Event emitted when the slider thumb moves. */
  // tslint:disable-next-line:no-output-native
  @Output() readonly input =  new EventEmitter<RangeSliderChange<NumberRange>>();

  /**
   * Emits when the raw value of the slider changes. This is here primarily
   * to facilitate the two-way binding for the `value` input.
   * @docs-private
   */
  @Output() readonly valueChange: EventEmitter<NumberRange> = new EventEmitter<NumberRange>();

  /** `View -> model callback called when value changes` */
  _onChange: (value: NumberRange) => void = () => {};

  /** `View -> model callback called when autocomplete has been touched` */
  _onTouched = () => {};

  get formGroupValueCorrected(): NumberRange {
    return ( this.formGroup.value.max < this.formGroup.value.min ?
                new NumberRange(this.formGroup.value.max, this.formGroup.value.min) :
                this.formGroup.value);
  }

  @Input()
  get value(): NumberRange|null {
    // If the value needs to be read and it is still uninitialized, initialize
    // it to the current minimum value.
    if (this._value === null) {
      this.value = this.formGroupValueCorrected;
    }
    return this._value;
  }
  set value(value: NumberRange|null) {
    this.writeToFormGroup(value);
  }

  constructor(private _r2: Renderer2) {
    this.formGroup.valueChanges
        .pipe(takeUntil(this._ngOnDestroy))
        .subscribe( (v: NumberRange) => {

      if ( v.min > v.max ) {
        v = new NumberRange(v.max, v.min);
      }
      this._onChange(v);
    });
  }

  ngOnInit(): void {
    this.resetFormGroup(true);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ( this.beforeOnInit ) { return; }
    const fgv = this.formGroup.value;
    if (changes.max) {
      if (changes.max.currentValue < fgv.max) {
        if (this.formGroup.get('max') ) {
          const c = this._switchCase ? 'min' : 'max';
          if (this.formGroup.get(c)){
            this.formGroup.get(c).setValue(changes[c].currentValue);
          }
        }
      }
      this.calculateFillBar();
    }
    if (changes.min) {
      if (changes.min.currentValue > fgv.min) {
        if (this.formGroup.get('min') ) {
          const c = this._switchCase ? 'max' : 'min';
          if (this.formGroup.get(c)){
            this.formGroup.get(c).setValue(changes[c].currentValue);
          }
        }
      }
      this.calculateFillBar();
    }
    if (changes.value) {
      this.calculateFillBar();
    }

    if (changes.invert) {
      this.calculateFillBar();
    }

    if (changes.vertical) {
      if (changes.vertical.currentValue) {
        this._r2.setStyle(this._fillBarEl, 'margin-left', null );
        this._r2.setStyle(this._fillBarEl, 'width' , null);
      } else {
        this._r2.setStyle(this._fillBarEl, 'bottom', null );
        this._r2.setStyle(this._fillBarEl, 'height' , null);
      }
      this.calculateFillBar();
    }
  }

  ngAfterViewInit(): void {
    const a = merge(
      this._sliderMax.valueChange.pipe(map(max => this.correctRange(max, 'max') )),
      this._sliderMin.valueChange.pipe(map(min => this.correctRange(min) )),
    ).pipe(
      tap(v => this.valueChange.next(v))
    );

    const b = merge(
      this._sliderMax.input.pipe(map(_ => this.correctRange(_.value, 'max') )),
      this._sliderMin.input.pipe(map(_ => this.correctRange(_.value) )),
    ).pipe(
      tap(v => {
        this.input.next({value: v});
        this.calculateFillBar(v);
      })
    );

    const c = merge(
      this._sliderMax.change.pipe(map(_ => this.correctRange(_.value, 'max') )),
      this._sliderMin.change.pipe(map(_ => this.correctRange(_.value) )),
    ).pipe(
      tap(v => this.change.next({value: v}) )
    );

    merge(a, b, c).pipe(takeUntil(this._ngOnDestroy)).subscribe();

    this._fillBarEl = this._sliderMax._elementRef.nativeElement
      .children[0]
      .children[0]
      .children[1];

    this.beforeOnInit = false;

    // this._sliderMax.focus()

  }

  ngOnDestroy(): void {
    this._ngOnDestroy.next();
    this._ngOnDestroy.complete();
  }

  /** If min overtakes max or other way around we have to correct for that */
  correctRange(value: number, useCase: 'min' | 'max' = 'min', formGroupValue = this.formGroup.value): NumberRange {

    let ans;
    if (useCase === 'min') {
      if (value <= formGroupValue.max) {
          ans = { ...formGroupValue, min: value };
          this._switchCase = false;
      } else {
          ans = { min: formGroupValue.max, max: value };
          this._switchCase = true;
      }
    } else {
      if (value > formGroupValue.min) {
        ans = { ...formGroupValue, max: value };
        this._switchCase = false;
      } else {
        ans = { min: value, max: formGroupValue.min };
        this._switchCase = true;
      }
    }
    return ans;
  }

  /** On (input) of mat-slider we need to span the fillbar between min and max */
  calculateFillBar(value: NumberRange = this.formGroupValueCorrected): void {
    // TODO(optimise) we dont have to calc this every time! Use onChanges hook
    if (!this._fillBarEl) {
      return;
    }

    const r = this.max - this.min;

    // width in percent
    const _wPCT = ((value.max - value.min) / r) * 100;
    const myDim = this.vertical ? 'height' : 'width';

    this._r2.setStyle(this._fillBarEl, myDim, _wPCT + '%');

    let _mlPCT;
    if (this.invert) {
      _mlPCT = ((this.max - value.max) / r) * 100;
    } else {
      // margin-left in percent
      _mlPCT = ((value.min - this.min) / r) * 100;
    }

    const myMargin = this.vertical ? 'bottom' : 'margin-left';
    this._r2.setStyle(this._fillBarEl, myMargin, _mlPCT  + '%' );
  }

   // Implemented as part of ControlValueAccessor.
  writeValue(value: any): void {
    this.writeToFormGroup(value);
    this.calculateFillBar();
  }

  // Implemented as part of ControlValueAccessor.
  registerOnChange(fn: (value: NumberRange) => {}): void {
    this._onChange = fn;
  }

  // Implemented as part of ControlValueAccessor.
  registerOnTouched(fn: () => {}): void {
    this._onTouched = fn;
  }

  // Implemented as part of ControlValueAccessor.
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  resetFormGroup(emit = false): void {
    this.formGroup.setValue(      {
        min: this.min ? this.min : 0,
        max: this.max ? this.max : 100
      },
      { emitEvent: emit }
    );
  }

  writeToFormGroup(value: any): void {
    if ( !value && value !== 0 ) {
      this.resetFormGroup();
      return;
    }

    const tryValue = Number(value);
    const fv = this.formGroup.value;

    if (!Number.isNaN(tryValue)) {
      if (tryValue !== fv.min && tryValue !== fv.max ) {
        let ans = {};
        ans = tryValue <= fv.max ?
              { ...fv, min: tryValue } :
              { ...fv, max: tryValue };

        this.formGroup.setValue(ans, {emitEvent: false});
      }
      return;
    }

    const _b1 = typeof value === 'object'   &&
                value !== null              &&
                value.hasOwnProperty('min') &&
                value.hasOwnProperty('max');

    if ( _b1 ) {
      const _b2 = !Number.isNaN(Number(value.min)) &&
                  !Number.isNaN(Number(value.max));
      if ( _b2 ) {
        this.formGroup.setValue(value);
      } else {
        this.resetFormGroup();
      }
      return;
    }

    this.resetFormGroup();
  }
}
