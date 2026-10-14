import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameViewportComponent } from './game-viewport.component';

describe('GameViewportComponent', () => {
  let component: GameViewportComponent;
  let fixture: ComponentFixture<GameViewportComponent>;

  beforeAll(() => {
    // Polyfill do ResizeObserver para ambiente JSDOM
    if (typeof window.ResizeObserver === 'undefined') {
      window.ResizeObserver = class {
        public observe = vi.fn();
        public unobserve = vi.fn();
        public disconnect = vi.fn();
      } as unknown as typeof ResizeObserver;
    }
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameViewportComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GameViewportComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('deve criar a instância do componente com sucesso', () => {
    expect(component).toBeTruthy();
  });

  it('deve conter o container de viewport e o elemento canvas WebGL no DOM', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const container = compiled.querySelector('.viewport-container');
    const canvas = compiled.querySelector('canvas.render-canvas');

    expect(container).not.toBeNull();
    expect(canvas).not.toBeNull();
  });

  it('deve exibir as informações do HUD e as instruções de controle de inspeção', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const brand = compiled.querySelector('.badge-brand');
    const instructions = compiled.querySelector('.instructions-panel');

    expect(brand?.textContent).toContain('Brick Survivors: Overdrive');
    expect(instructions?.textContent).toContain('Inspecionar Câmera');
    expect(instructions?.textContent).toContain('Zoom');
  });

  it('deve executar o ciclo de vida ngAfterViewInit e ngOnDestroy limpando recursos sem erros', () => {
    fixture.detectChanges(); // Dispara ngAfterViewInit

    expect(() => {
      component.ngOnDestroy();
    }).not.toThrow();
  });

  it('deve lidar com eventos de mouse/ponteiro para inspeção sem quebrar', () => {
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('canvas.render-canvas') as HTMLCanvasElement;

    expect(() => {
      canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 120, clientY: 110 }));
      window.dispatchEvent(new PointerEvent('pointerup'));
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 50 }));
    }).not.toThrow();
  });
});
