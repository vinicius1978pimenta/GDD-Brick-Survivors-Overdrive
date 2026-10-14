import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GameViewportComponent } from './components/game-viewport';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, GameViewportComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly title = signal('Brick Survivors: Overdrive');
  protected readonly phase = signal('FASE 3: Movimentação, Física Arcade & Controle de Veículos');
}
