import { CharacterMeshFactory } from './character-mesh.factory';
import { CharacterType } from '../../core/engine/types/character.types';

describe('CharacterMeshFactory', () => {
  const characters: CharacterType[] = [
    'hobo_lego',
    'hillbilly_girl',
    'funny_indigenous',
    'black_shorts',
  ];

  characters.forEach((charType) => {
    it(`deve construir a malha 3D completa com pivôs de animação para ${charType}`, () => {
      const result = CharacterMeshFactory.createCharacterMesh(charType, false);

      expect(result).toBeDefined();
      expect(result.group).toBeDefined();
      expect(result.group.name).toBe(`char_${charType}`);

      // Verifica presença e configuração dos pivôs essenciais para animação LEGO
      expect(result.leftLegPivot).toBeDefined();
      expect(result.rightLegPivot).toBeDefined();
      expect(result.leftArmPivot).toBeDefined();
      expect(result.rightArmPivot).toBeDefined();
      expect(result.head).toBeDefined();
      expect(result.torso).toBeDefined();

      // userData deve conter referências para controle no viewport
      expect(result.group.userData['leftLegPivot']).toBe(result.leftLegPivot);
      expect(result.group.userData['rightLegPivot']).toBe(result.rightLegPivot);
      expect(result.group.userData['leftArmPivot']).toBe(result.leftArmPivot);
      expect(result.group.userData['rightArmPivot']).toBe(result.rightArmPivot);

      // Deve ter múltiplos blocos filhos montados
      expect(result.group.children.length).toBeGreaterThan(3);
    });
  });
});
