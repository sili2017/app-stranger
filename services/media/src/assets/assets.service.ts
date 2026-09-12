import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainError } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';
import { LocalFilesystemStorageAdapter } from '../storage/local-filesystem-storage.adapter';
import { UploadAssetDto } from './dto';

const MAX_BYTES = 8 * 1024 * 1024; // 8MB — generous for a phone photo or a scanned ID page

@Injectable()
export class AssetsService {
  // [BLOCKED: ADQ-005] local filesystem, matching the storage adapter's own module doc —
  // swap the adapter binding, not this service, once a real provider is approved.
  private readonly storage = new LocalFilesystemStorageAdapter(
    process.env.MEDIA_STORAGE_DIR ?? '.tooling/media-storage',
  );

  constructor(private readonly prisma: PrismaService) {}

  async upload(ownerUserId: string, dto: UploadAssetDto) {
    let contents: Buffer;
    try {
      contents = Buffer.from(dto.base64Data, 'base64');
    } catch {
      throw new DomainError('INVALID_ASSET_DATA', 'errors.invalidAssetData', HttpStatus.BAD_REQUEST);
    }
    if (contents.length === 0 || contents.length > MAX_BYTES) {
      throw new DomainError('ASSET_TOO_LARGE', 'errors.assetTooLarge', HttpStatus.BAD_REQUEST, [
        { field: 'base64Data', issue: `must decode to 1..${MAX_BYTES} bytes` },
      ]);
    }

    const asset = await this.prisma.asset.create({
      data: { ownerUserId, contentType: dto.contentType, byteSize: contents.length, storageKey: '' },
    });
    const storageKey = `${ownerUserId}/${asset.id}-${dto.filename}`;
    await this.storage.put(storageKey, contents, dto.contentType);
    await this.prisma.asset.update({ where: { id: asset.id }, data: { storageKey } });

    return { id: asset.id, contentType: asset.contentType, byteSize: asset.byteSize };
  }
}
