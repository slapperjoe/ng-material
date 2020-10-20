import { Component } from '@angular/core';
import { NumberRange } from './range-slider/number-range.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less']
})
export class AppComponent {
  title = 'ng-material';

  public value = new NumberRange(35, 65);
}
