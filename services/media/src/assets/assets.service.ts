import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainError } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';
import { createStorageAdapter } from '../storage/storage-adapter-factory';
import { UploadAssetDto } from './dto';

const MAX_BYTES = 8 * 1024 * 1024; // 8MB — generous for a phone photo or a scanned ID page

@Injectable()
export class AssetsService {
  private readonly storage = createStorageAdapter();

  constructor(private readonly prisma: PrismaService) {}

  async upload(ownerUserId: string, dto: UploadAssetDto) {
    let contents: Buffer;
    try {
      contents = Buffer.from(dto.base64Data, 'base64');
    } catch {
      throw new DomainError(
        'INVALID_ASSET_DATA',
        'errors.invalidAssetData',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (contents.length === 0 || contents.length > MAX_BYTES) {
      throw new DomainError('ASSET_TOO_LARGE', 'errors.assetTooLarge', HttpStatus.BAD_REQUEST, [
        { field: 'base64Data', issue: `must decode to 1..${MAX_BYTES} bytes` },
      ]);
    }

    const asset = await this.prisma.asset.create({
      data: {
        ownerUserId,
        contentType: dto.contentType,
        byteSize: contents.length,
        storageKey: '',
      },
    });
    const storageKey = `${ownerUserId}/${asset.id}-${dto.filename}`;
    await this.storage.put(storageKey, contents, dto.contentType);
    await this.prisma.asset.update({ where: { id: asset.id }, data: { storageKey } });

    return { id: asset.id, contentType: asset.contentType, byteSize: asset.byteSize };
  }

  /** Feature 25: backs GET /assets/:id/content — the profile-photo/verification-photo
   * display gap (there was previously no way to read an uploaded asset back at all). */
  async getContent(id: string): Promise<{ contentType: string; bytes: Buffer }> {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      throw new DomainError('ASSET_NOT_FOUND', 'errors.assetNotFound', HttpStatus.NOT_FOUND);
    }
    const bytes = await this.storage.get(asset.storageKey);
    return { contentType: asset.contentType, bytes };
  }
}
