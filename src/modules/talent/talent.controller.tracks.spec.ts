import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { TalentController } from './talent.controller';
import { TalentService } from './talent.service';
import { UploadService } from '../upload/upload.service';
import { listTalentSupportedRoleTracks } from './talent.constants';

describe('TalentController supported role tracks', () => {
  let controller: TalentController;
  let talentService: { listSupportedRoleTracks: jest.Mock };

  beforeEach(async () => {
    talentService = {
      listSupportedRoleTracks: jest.fn().mockReturnValue({
        tracks: listTalentSupportedRoleTracks(),
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [TalentController],
      providers: [
        { provide: TalentService, useValue: talentService },
        { provide: UploadService, useValue: {} },
      ],
    }).compile();

    controller = moduleRef.get(TalentController);
  });

  it('maps GET onboarding/tracks to the list handler', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, controller.listSupportedRoleTracks),
    ).toBe('onboarding/tracks');
    expect(
      Reflect.getMetadata(METHOD_METADATA, controller.listSupportedRoleTracks),
    ).toBe(RequestMethod.GET);
  });

  it('returns the canonical supported role track catalog', () => {
    const result = controller.listSupportedRoleTracks();

    expect(talentService.listSupportedRoleTracks).toHaveBeenCalled();
    expect(result.tracks).toHaveLength(20);
    expect(result.tracks).toEqual(
      expect.arrayContaining([
        {
          slug: 'frontend_developer',
          label: 'Frontend Developer',
          roleCode: 'FED',
        },
        {
          slug: 'product_manager',
          label: 'Product Manager',
          roleCode: 'PMG',
        },
      ]),
    );
  });
});
