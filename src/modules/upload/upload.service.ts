import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../../config/env';
import { randomUUID } from 'crypto';

@Injectable()
export class UploadService {
  private readonly s3: S3Client | null;

  constructor() {
    if (
      env.AWS_REGION &&
      env.AWS_S3_BUCKET &&
      env.AWS_ACCESS_KEY_ID &&
      env.AWS_SECRET_ACCESS_KEY
    ) {
      this.s3 = new S3Client({
        region: env.AWS_REGION,
        ...(env.AWS_ENDPOINT
          ? { endpoint: env.AWS_ENDPOINT, forcePathStyle: true }
          : {}),
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
      });
    } else {
      this.s3 = null;
    }
  }

  async uploadAvatar(file: Express.Multer.File): Promise<string> {
    return this.uploadToS3('avatars/', file, 'jpg');
  }

  async uploadResume(file: Express.Multer.File): Promise<string> {
    return this.uploadToS3('resumes/', file, 'pdf');
  }

  async uploadJdDocument(file: Express.Multer.File): Promise<string> {
    const mimeToExt: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        'docx',
    };
    const ext = mimeToExt[file.mimetype] ?? 'pdf';
    return this.uploadToS3('jd-documents/', file, ext);
  }

  private async uploadToS3(
    prefix: string,
    file: Express.Multer.File,
    defaultExt: string,
  ): Promise<string> {
    if (!this.s3 || !env.AWS_S3_BUCKET || !env.AWS_REGION) {
      throw new ServiceUnavailableException(
        'File upload is not configured on this server',
      );
    }

    const ext = file.originalname.split('.').pop() ?? defaultExt;
    const key = `${prefix}${randomUUID()}.${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return this.buildPublicUrl(key);
  }

  private buildPublicUrl(key: string): string {
    if (env.AWS_PUBLIC_URL) {
      return `${env.AWS_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
    }

    if (env.AWS_ENDPOINT) {
      const base = env.AWS_ENDPOINT.replace(/\/$/, '');
      return `${base}/${env.AWS_S3_BUCKET}/${key}`;
    }

    return `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
  }
}
